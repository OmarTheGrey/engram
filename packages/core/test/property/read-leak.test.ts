// What a read reveals (decision D5 of the review fix pass, finding R5-1): the
// items, explanations, scores, ranks and filtered count a reader gets are the
// same whether or not the store also holds items the reader cannot reach (in
// no scope it may read, with no grant naming it). Non-interference, checked
// over generated policies, scopes, grants, readers and queries, with and
// without query text, on a store with and without search.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { type Actor, createPlane, type ReadResult } from "../../src/plane.ts";
import type { MemoryItem, Policy } from "../../src/schema.ts";
import { arbActor, arbGatedItem, arbInstant, arbPolicy, seedFor } from "../generators.ts";
import { patternCovers } from "./oracle.ts";

const RUNS = 500;

const level = (scope: string) => (scope === "org" ? "org" : scope.split(":")[0]);

/** Could `reader` reach `item` at all: by a readable scope, or by a grant naming it? */
function reachable(policy: Policy, reader: Actor, item: MemoryItem): boolean {
  const row = policy.read.matrix.find((r) => r.reader === reader.level);
  const byScope =
    reader.memberships.includes(item.scope) &&
    (row?.may_read ?? []).some((l) => l === level(item.scope));
  const byGrant =
    policy.read.honour_grants && item.grants.some((g) => patternCovers(g.to, reader.id));
  return byScope || byGrant;
}

const ADMIT_ALL = (policy: Policy): Policy => ({
  ...policy,
  id: "admit-all",
  write: (["person", "role", "team", "org"] as const).map((scope) => ({
    scope,
    allowed_sources: ["user", "document", "tool", "model", "import", "compaction"],
    confidence_floor: 0,
    forbidden_classes: [],
    requires_review: false,
  })),
});

async function readWith(
  policy: Policy,
  stored: MemoryItem[],
  reader: Actor,
  text: string | undefined,
  at: string,
  search: boolean,
): Promise<ReadResult> {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = createFakeAdapter({ search });
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const writer: Actor = {
    id: "person:omar",
    level: "person",
    memberships: [...new Set(stored.map((i) => i.scope))],
  };
  const store = createPlane({ db, adapter, policy: ADMIT_ALL(policy), newId });
  for (const item of stored) await store.write(writer, item, at);
  return createPlane({ db, adapter, policy, newId }).read(reader, { text, at });
}

const words = (items: MemoryItem[]) =>
  items.flatMap((i) =>
    (typeof i.content === "string" ? i.content : JSON.stringify(i.content))
      .split(/\s+/)
      .filter(Boolean),
  );

const flags = fc.array(fc.boolean(), { minLength: 8, maxLength: 8 });

const scenario = fc
  .record({
    pool: fc.uniqueArray(arbGatedItem, { selector: (i) => i.id, maxLength: 8 }),
    hide: flags,
    // A visible item that carries a grant to the reader, so its scope is searched.
    bridge: flags,
    // Hidden items move into a bridged (or other visible) scope as often as not.
    shareScope: flags,
    // Items whose content also holds the common word, so hidden and visible hits meet.
    common: flags,
  })
  .chain((s) => {
    const w = words(s.pool);
    const text: fc.Arbitrary<string | undefined> = fc.oneof(
      fc.constant(undefined),
      { arbitrary: fc.constant(COMMON), weight: 3 },
      w.length > 0 ? fc.constantFrom(...w) : fc.constant("nothing"),
    );
    return fc.record({ s: fc.constant(s), text, search: fc.boolean() });
  });

const COMMON = "deploys";

/** `item` with the common word added to its text. */
function withCommonWord(item: MemoryItem): MemoryItem {
  return item.class === "procedural"
    ? { ...item, content: { ...item.content, body: `${item.content.body} ${COMMON}` } }
    : {
        ...item,
        content:
          typeof item.content === "string"
            ? `${item.content} ${COMMON}`
            : { ...item.content, note: COMMON },
      };
}

/** Builds the stored items: visible ones, some bridging a scope to the reader, and hidden ones. */
function build(policy: Policy, reader: Actor, s: Scenario) {
  const shaped = s.pool.map((item, i) => {
    let out = s.common[i] ? withCommonWord(item) : item;
    const trusted = !["model", "compaction"].includes(out.provenance.kind);
    if (!s.hide[i] && s.bridge[i] && trusted)
      out = {
        ...out,
        grants: [
          ...out.grants,
          { to: reader.id, mode: "read", class: out.class, expires: "2099-01-01T00:00:00Z" },
        ],
      };
    if (s.hide[i])
      out = { ...out, grants: out.grants.filter((g) => !patternCovers(g.to, reader.id)) };
    return out;
  });
  const bridged = shaped.filter((_, i) => !s.hide[i] && s.bridge[i]).map((i) => i.scope);
  const visibleScopes = shaped.filter((_, i) => !s.hide[i]).map((i) => i.scope);
  const targets = bridged.length > 0 ? bridged : visibleScopes;
  const all = shaped.map((item, i) => {
    const target = targets[i % Math.max(1, targets.length)];
    return s.hide[i] && s.shareScope[i] && target ? { ...item, scope: target } : item;
  });
  const hidden = all.filter((item, i) => s.hide[i] && !reachable(policy, reader, item));
  return { all, hidden, visible: all.filter((item) => !hidden.includes(item)) };
}

interface Scenario {
  pool: MemoryItem[];
  hide: boolean[];
  bridge: boolean[];
  shareScope: boolean[];
  common: boolean[];
}

describe("reads reveal nothing about unreachable items (decision D5)", () => {
  const NAME = "a read's items, explanations, scores and filtered count ignore unreachable items";
  test(NAME, async () => {
    const seen = { interfering: 0, hiddenHits: 0 };
    await fc.assert(
      fc.asyncProperty(
        // Grants honoured in three cases of four, so bridged scopes are common.
        fc
          .tuple(arbPolicy, fc.nat(3))
          .map(([p, k]) => (k > 0 ? { ...p, read: { ...p.read, honour_grants: true } } : p)),
        arbActor,
        scenario,
        arbInstant,
        async (policy, reader, { s, text, search }, at) => {
          const { all, hidden, visible } = build(policy, reader, s);
          if (hidden.length > 0) seen.interfering++;
          // Hidden items the store's search would find in a scope the plane searches.
          const searched = new Set(
            visible.filter((v) => reachable(policy, reader, v)).map((v) => v.scope),
          );
          const term = (text ?? "").toLowerCase();
          if (
            search &&
            term &&
            hidden.some(
              (h) =>
                searched.has(h.scope) && JSON.stringify(h.content).toLowerCase().includes(term),
            )
          )
            seen.hiddenHits++;
          const without = await readWith(policy, visible, reader, text, at, search);
          const withHidden = await readWith(policy, all, reader, text, at, search);
          const view = (r: ReadResult) => ({
            items: r.items,
            explanations: r.explanations,
            filtered: r.filtered,
            policy_id: r.event.policy_id,
            decision: r.event.decision,
          });
          expect(
            view(withHidden),
            `hidden items ${hidden.map((h) => `${h.id}@${h.scope}`).join(", ")} changed what ${reader.id} (${reader.level}, member of [${reader.memberships.join(", ")}]) read for ${JSON.stringify(text)}`,
          ).toEqual(view(without));
        },
      ),
      { numRuns: RUNS, seed: seedFor(NAME) },
    );
    expect(seen.interfering, "cases with at least one hidden item").toBeGreaterThan(RUNS / 4);
    expect(
      seen.hiddenHits,
      "cases where the store finds a hidden item in a scope the plane searches",
    ).toBeGreaterThan(RUNS / 20);
  }, 120_000);
});
