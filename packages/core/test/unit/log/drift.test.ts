// The drift test of ADR 0038 (card E1.6): the chain's skeleton swaps for
// commitments exactly what an offboarding rewrites. A generated event
// redacted as offboarding redacts it (log/redact.ts, the functions
// offboard.ts calls) keeps its skeleton hash; any other single-field edit,
// at any depth, or a field added or removed, changes it. Then the same
// through a real offboarding: every event it redacted, item events and lint
// events alike, keeps its skeleton hash under its stored commitments. A
// redaction added to offboard.ts that the skeleton does not know fails here.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { Actor } from "../../../src/actor.ts";
import { migrate } from "../../../src/db/migrate.ts";
import { openSqlite } from "../../../src/db/sqlite.ts";
import { allEvents } from "../../../src/events.ts";
import { commitments, committedParts, keepChain, skeletonHash } from "../../../src/log/chain.ts";
import { redacted, redactedLintReason } from "../../../src/log/redact.ts";
import { createPlane, offboard } from "../../../src/plane.ts";
import type { MemoryEvent, MemoryItem } from "../../../src/schema.ts";
import { arbEventInput, seedFor } from "../../generators.ts";
import { seededKeeper } from "../../helpers/chain.ts";
import { AT, id, item, testPolicy } from "../plane/helpers.ts";

const IDS = [id(1), id(2), id(3)];
const LINT_REASONS = [
  "orphan (warn): provenance ref names a missing item; evidence: 01920000-0000-7000-8000-000000000002",
  "duplicate (info): two items hold the same content; evidence: sha256:ab",
  "a reason with no lint head",
];

/** Generated events with every optional part the schema allows, lint reasons with and without a head. */
const arbEvent: fc.Arbitrary<MemoryEvent> = fc
  .record({
    input: arbEventInput(IDS),
    seq: fc.nat({ max: 1000 }),
    lintReason: fc.constantFrom(...LINT_REASONS),
    entry: fc.option(fc.constantFrom("entry-1", "entry-2"), { nil: undefined }),
    expires: fc.option(fc.constantFrom("2026-12-01T00:00:00Z", "2026-12-01T00:00:00.5Z"), {
      nil: undefined,
    }),
    usage: fc.boolean(),
    itemIds: fc.boolean(),
  })
  .map(({ input, seq, lintReason, entry, expires, usage, itemIds }) => {
    const event = { ...input, seq } as MemoryEvent;
    if (event.op === "lint") event.reason = lintReason;
    if (event.op === "read" && itemIds) event.item_ids = [IDS[0] as string];
    if (usage)
      event.usage = {
        input_tokens: 10,
        output_tokens: 2,
        cost_usd: 0.25,
      };
    if (event.item) {
      const it = { ...event.item, provenance: { ...event.item.provenance } } as MemoryItem;
      if (entry !== undefined) it.provenance.session_entry_id = entry;
      if (expires !== undefined)
        it.grants = [{ to: "person:sam", class: it.class, mode: "read", expires }];
      event.item = it;
    }
    return event;
  });

/** The event as offboarding leaves it. */
function redact(event: MemoryEvent): MemoryEvent {
  let out = event;
  if (event.item) out = { ...out, item: redacted(event.item) };
  if (event.op === "lint") out = { ...out, reason: redactedLintReason(event.reason) };
  return out;
}

const SALT = new Uint8Array(32).fill(7);

/** Paths of the committed parts, which the skeleton does not hash as they are. */
const COMMITTED = [
  "item.content",
  "item.provenance.ref",
  "item.provenance.hash",
  "item.provenance.session_entry_id",
];

type Path = (string | number)[];

/** Every leaf and inner path of `value`, outside the committed parts and the lint reason. */
function paths(value: unknown, at: Path = []): Path[] {
  const out: Path[] = [];
  const key = at.join(".");
  if (COMMITTED.some((c) => key === c || key.startsWith(`${c}.`))) return out;
  if (at.length > 0) out.push(at);
  if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value))
      if (v !== undefined) out.push(...paths(v, [...at, Array.isArray(value) ? Number(k) : k]));
  return out;
}

/** A copy of `event` with the value at `path` changed, or removed. */
function edited(event: MemoryEvent, path: Path, remove: boolean): MemoryEvent {
  const copy = structuredClone(event) as unknown as Record<string | number, unknown>;
  let parent = copy;
  for (const p of path.slice(0, -1)) parent = parent[p] as Record<string | number, unknown>;
  const last = path.at(-1) as string | number;
  const v = parent[last];
  if (remove) {
    if (Array.isArray(parent)) parent.splice(Number(last), 1);
    else delete parent[last];
  } else if (typeof v === "string") parent[last] = `${v}x`;
  else if (typeof v === "number") parent[last] = v + 1;
  else if (typeof v === "boolean") parent[last] = !v;
  else if (v === null) parent[last] = "x";
  else if (Array.isArray(v)) v.push("x");
  else (v as Record<string, unknown>).extra = 1;
  return copy as unknown as MemoryEvent;
}

describe("the skeleton against offboarding's redaction", () => {
  const unchanged = "a redaction as offboarding makes it leaves the skeleton hash unchanged";
  test(unchanged, () => {
    fc.assert(
      fc.property(arbEvent, (event) => {
        const c = commitments(event, SALT);
        expect(skeletonHash(redact(event), c)).toBe(skeletonHash(event, c));
      }),
      { numRuns: 500, seed: seedFor(unchanged) },
    );
  });

  const changes = "any other single-field edit, removal or addition changes the skeleton hash";
  test(changes, () => {
    let edits = 0;
    fc.assert(
      fc.property(arbEvent, (event) => {
        const c = commitments(event, SALT);
        const before = skeletonHash(event, c);
        for (const path of paths(event)) {
          // The lint reason's evidence is committed; its head is not.
          if (event.op === "lint" && path.join(".") === "reason") continue;
          for (const remove of [false, true]) {
            const after = edited(event, path, remove);
            expect(
              skeletonHash(after, c),
              `${remove ? "removed" : "edited"} ${path.join(".")}`,
            ).not.toBe(before);
            edits++;
          }
        }
        // A field added at the top changes it too.
        expect(skeletonHash({ ...event, extra: 1 } as MemoryEvent, c)).not.toBe(before);
        if (event.op === "lint") {
          const head = /^(\S+) \((info|warn|error)\): /.exec(event.reason);
          if (head) {
            const other = event.reason.replace(head[0], `${head[1]}x (${head[2]}): `);
            expect(skeletonHash({ ...event, reason: other }, c), "the lint head").not.toBe(before);
          }
        }
      }),
      { numRuns: 300, seed: seedFor(changes) },
    );
    expect(edits).toBeGreaterThan(1000);
  });

  test("every committed part is one offboarding rewrites, and nothing else is committed", () => {
    const withItem = {
      id: id(9),
      seq: 0,
      ts: AT,
      op: "write",
      item_id: id(1),
      actor: "person:dana",
      scope_from: null,
      scope_to: "person:dana",
      decision: "allow",
      reason: "r",
      policy_id: "p",
      item: item(1, { scope: "person:dana", owner: "person:dana" }),
      schema_version: 1,
    } as MemoryEvent;
    const lint = {
      ...withItem,
      op: "lint",
      item: undefined,
      reason: LINT_REASONS[0],
    } as MemoryEvent;
    const plain = { ...withItem, op: "retire", item: undefined } as MemoryEvent;
    expect([...committedParts(withItem).keys()].sort()).toEqual([
      "content",
      "provenance.hash",
      "provenance.ref",
      "provenance.session_entry_id",
    ]);
    expect([...committedParts(lint).keys()]).toEqual(["reason.evidence"]);
    expect(committedParts(plain).size).toBe(0);
  });
});

describe("the skeleton through a real offboarding", () => {
  test("every event an offboarding redacted keeps its skeleton hash under its stored commitments", async () => {
    const db = openSqlite(":memory:");
    migrate(db);
    keepChain(db, seededKeeper(1));
    let n = 0;
    const deps = {
      db,
      adapter: createFakeAdapter(),
      policy: testPolicy({ lints: { enabled: ["source-changed", "duplicate"], thresholds: {} } }),
      newId: () => id(950_000 + ++n),
    };
    const plane = createPlane(deps);
    const dana: Actor = {
      id: "person:dana",
      level: "person",
      memberships: ["person:dana", "team:core"],
      source: "user",
    };
    const source = item(1, { scope: "person:dana", owner: "person:dana", content: "the source" });
    await plane.write(dana, source, AT);
    await plane.write(
      dana,
      item(2, {
        scope: "team:core",
        owner: "person:dana",
        content: "a team note",
        provenance: {
          kind: "user",
          ref: id(1),
          hash: `sha256:${"ab".repeat(32)}`,
          actor: "person:dana",
        },
      }),
      AT,
    );
    await plane.write(
      dana,
      { ...source, content: "the source, changed", version: 2 } as MemoryItem,
      AT,
    );
    await plane.write(
      dana,
      item(3, { scope: "person:dana", owner: "person:dana", content: "dup" }),
      AT,
    );
    await plane.write(
      dana,
      item(4, { scope: "person:dana", owner: "person:dana", content: "dup" }),
      AT,
    );
    for (const scope of dana.memberships) await plane.lint(dana, AT, scope);
    const before = allEvents(db);
    const stored = new Map(
      db
        .prepare("SELECT seq, data FROM chain WHERE kind = 'event'")
        .all()
        .map((r) => [Number(r.seq), JSON.parse(String(r.data)) as Record<string, string>]),
    );
    await offboard(deps, dana, { person: "person:dana", roles: [] }, "2026-10-26T00:00:00Z");
    const after = new Map(allEvents(db).map((e) => [e.seq, e]));
    const changed = before.filter((e) => JSON.stringify(after.get(e.seq)) !== JSON.stringify(e));
    // Item events and a lint event about the team item, which survives.
    expect(changed.some((e) => e.item)).toBe(true);
    expect(changed.some((e) => e.op === "lint" && e.item_id === id(2))).toBe(true);
    for (const e of changed) {
      const c = stored.get(e.seq) ?? {};
      expect(skeletonHash(after.get(e.seq) as MemoryEvent, c), `seq ${e.seq}`).toBe(
        skeletonHash(e, c),
      );
    }
  });
});
