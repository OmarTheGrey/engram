// Card L6, review fix L6-1: the supersession plan says nothing of an item the
// read filter refuses. A member of team:x on the medium preset asks about,
// and accepts closes of, items it may reach by scope but not read: one
// held as a candidate, one retired, one past its ttl, one not yet valid,
// one whose window has ended, and one in a scope it is not a member of.
//
// Four claims, over generated logs of such items mixed with readable ones,
// their lineage pointing anywhere among them:
//   1. asking about a hidden item gives the unknown id's answer, word for
//      word but for the id;
//   2. a hidden item does not change the plan of a readable one at all: the
//      plan equals the plan over the same log without the hidden items;
//   3. no plan's JSON carries a hidden item's content or any of its instants;
//   4. accepting a hidden item's close is refused with the unknown id's
//      message, before anything is written.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { InvalidCallError } from "../../src/actor.ts";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { allEvents, appendEvent } from "../../src/events.ts";
import type { Actor } from "../../src/plane.ts";
import { loadPreset } from "../../src/policy/load.ts";
import type { MemoryItem } from "../../src/schema.ts";
import { acceptedClosures, planSupersession } from "../../src/supersede.ts";
import { seedFor } from "../generators.ts";

const LEAK = "a hidden item is an unknown id to the plan and changes no readable item's plan";

const policy = loadPreset("medium");
const mate: Actor = {
  id: "person:mate",
  level: "person",
  memberships: ["person:mate", "team:x"],
  source: "user",
};
/** Instant n: n days after 2026-01-01, with a marker second so a leak is findable. */
const t = (n: number) => new Date(Date.UTC(2026, 0, 1 + n, 0, 0, 7)).toISOString();
const AT = t(400);
const uuid = (n: number) => `01970000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const UNKNOWN = uuid(999);
/** A second id no item holds, for comparisons whose two ids must differ. */
const UNKNOWN_2 = uuid(998);

const KINDS = ["visible", "candidate", "retired", "expired", "future", "ended", "foreign"] as const;
type Kind = (typeof KINDS)[number];

interface Spec {
  kind: Kind;
  from: number;
  lineage: number[];
}

function itemOf(n: number, s: Spec): MemoryItem {
  const hidden = s.kind !== "visible";
  const from =
    s.kind === "future" ? 401 + s.from : s.kind === "ended" ? s.from : Math.min(s.from, 390);
  return {
    id: uuid(n),
    class: "semantic",
    scope: s.kind === "foreign" ? "team:y" : "team:x",
    owner: "person:own",
    content: hidden ? `SECRET-${n}-${s.kind}` : `visible fact ${n}`,
    provenance: { kind: "user", ref: "r", hash: `sha256:${"0".repeat(64)}`, actor: "person:own" },
    confidence: 0.9,
    valid_from: t(from),
    valid_to: s.kind === "ended" ? t(from + 1) : null,
    ttl: s.kind === "expired" ? 60 : null,
    grants: [],
    version: 1,
    lineage: s.lineage.map(uuid),
    status: s.kind === "candidate" ? "candidate" : s.kind === "retired" ? "retired" : "active",
    store_ref: null,
    schema_version: 1,
  } as MemoryItem;
}

/** A log holding `items`, each written by a seeded allow event, as an adoption would leave it. */
function logOf(items: readonly MemoryItem[]) {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  for (const item of items)
    appendEvent(db, {
      id: uuid(5000 + ++n),
      ts: t(0),
      op: "write",
      item_id: item.id,
      actor: item.owner,
      scope_from: null,
      scope_to: item.scope,
      decision: "allow",
      reason: "seeded",
      policy_id: "seed",
      item,
      schema_version: 1,
    });
  return db;
}

const arbLog = fc
  .array(
    fc.record({
      kind: fc.constantFrom(...KINDS),
      from: fc.integer({ min: 0, max: 380 }),
      lineage: fc.uniqueArray(fc.integer({ min: 1, max: 8 }), { maxLength: 3 }),
    }),
    { minLength: 1, maxLength: 8 },
  )
  .map((specs) => specs.map((s, i) => itemOf(i + 1, s)));

/** The refusal message for accepting `id`, with that id written as a placeholder. */
function refusal(db: Parameters<typeof acceptedClosures>[0], startId: string, id: string) {
  const plan = planSupersession(db, policy, mate, startId, AT);
  try {
    acceptedClosures(db, plan, [id]);
  } catch (e) {
    expect(e).toBeInstanceOf(InvalidCallError);
    return (e as Error).message.replaceAll(id, "<id>").replaceAll(startId, "<start>");
  }
  throw new Error(`accepting ${id} was not refused`);
}

describe("the supersession plan and the read filter (card L6, L6-1)", () => {
  test(LEAK, () => {
    fc.assert(
      fc.property(arbLog, (items) => {
        const hidden = items.filter((i) => !i.content.startsWith("visible"));
        const visible = items.filter((i) => i.content.startsWith("visible"));
        const full = logOf(items);
        const bare = logOf(visible);
        const unknown = planSupersession(full, policy, mate, UNKNOWN, AT);
        const secrets = hidden.flatMap((i) => [
          i.content,
          i.valid_from,
          ...(i.valid_to ? [i.valid_to] : []),
        ]);
        // 1. A hidden item is the unknown id, but for the id.
        for (const h of hidden)
          expect(planSupersession(full, policy, mate, h.id, AT)).toEqual({
            ...unknown,
            item_id: h.id,
          });
        // 2 and 3. A readable item's plan is the same without the hidden items, and names none of them.
        for (const v of visible) {
          const plan = planSupersession(full, policy, mate, v.id, AT);
          expect(plan).toEqual(planSupersession(bare, policy, mate, v.id, AT));
          const json = JSON.stringify(plan);
          for (const s of secrets) expect(json).not.toContain(s);
          for (const h of hidden) expect(json).not.toContain(h.id);
        }
        // 4. Accepting a hidden item's close is refused as an unknown id's, from any start.
        const before = allEvents(full).length;
        const ids = [...items.map((i) => i.id), UNKNOWN];
        const other = (start: string) => (start === UNKNOWN ? UNKNOWN_2 : UNKNOWN);
        for (const start of ids)
          for (const h of hidden)
            if (h.id !== start)
              expect(refusal(full, start, h.id)).toBe(refusal(full, start, other(start)));
        // And any accept from a hidden start is refused as from an unknown one.
        for (const h of hidden)
          for (const id of ids)
            if (id !== h.id && id !== UNKNOWN)
              expect(refusal(full, h.id, id)).toBe(refusal(full, UNKNOWN, id));
        expect(allEvents(full)).toHaveLength(before);
        full.close();
        bare.close();
      }),
      { numRuns: 300, seed: seedFor(LEAK) },
    );
  });
});
