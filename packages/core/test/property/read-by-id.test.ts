// The by-id read and the scope list go through Plane.read's gate (card
// E8.14), checked over generated policies, items, grants, readers and times:
// a read of one id returns exactly the item a read with no text returns under
// that id (or nothing), with the same explanation but for rank and score; and
// a listed scope is one the reader can read by membership, or the scope of an
// item such a read admits through a grant, and nothing else.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { type Actor, createPlane } from "../../src/plane.ts";
import { readableScope } from "../../src/policy/evaluate.ts";
import type { MemoryItem, Policy } from "../../src/schema.ts";
import {
  arbActor,
  arbGatedItemWithValidTo,
  arbInstant,
  arbPolicy,
  seedFor,
} from "../generators.ts";

const RUNS = 300;

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

async function planeWith(policy: Policy, stored: MemoryItem[], at: string) {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = createFakeAdapter();
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const writer: Actor = {
    id: "person:omar",
    level: "person",
    memberships: [...new Set(stored.map((i) => i.scope))],
  };
  const seeding = createPlane({ db, adapter, policy: ADMIT_ALL(policy), newId });
  for (const item of stored) await seeding.write(writer, item, at);
  return createPlane({ db, adapter, policy, newId });
}

/** Grants honoured in three cases of four, so grant-reached items are common. */
const arbHonouring = fc
  .tuple(arbPolicy, fc.nat(3))
  .map(([p, k]) => (k > 0 ? { ...p, read: { ...p.read, honour_grants: true } } : p));

/** Some items carry a live grant to the reader, so the grant path is exercised. */
const arbScenario = fc.record({
  pool: fc.uniqueArray(arbGatedItemWithValidTo, { selector: (i) => i.id, maxLength: 6 }),
  bridge: fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
});

function shaped(pool: MemoryItem[], bridge: boolean[], reader: Actor): MemoryItem[] {
  return pool.map((item, i) =>
    bridge[i] && !["model", "compaction"].includes(item.provenance.kind)
      ? {
          ...item,
          grants: [
            ...item.grants,
            { to: reader.id, mode: "read", class: item.class, expires: "2099-01-01T00:00:00Z" },
          ],
        }
      : item,
  );
}

describe("the by-id read and the scope list decide as Plane.read does", () => {
  const BY_ID = "a by-id read returns exactly what a read with no text returns under that id";
  test(BY_ID, async () => {
    let returned = 0;
    await fc.assert(
      fc.asyncProperty(
        arbHonouring,
        arbActor,
        arbScenario,
        arbInstant,
        async (policy, reader, { pool, bridge }, at) => {
          const items = shaped(pool, bridge, reader);
          const plane = await planeWith(policy, items, "2026-10-01T00:00:00Z");
          const all = await plane.read(reader, { at });
          for (const item of [...items, { id: "01920000-0000-7000-8000-0000000fffff" }]) {
            const one = await plane.readById(reader, item.id, { at });
            const expected = all.items.filter((i) => i.id === item.id);
            expect(one.items, `${reader.id} reading ${item.id} at ${at}`).toEqual(expected);
            returned += one.items.length;
            const strip = (e: (typeof one.explanations)[number]) => ({
              item_id: e.item_id,
              policy_id: e.policy_id,
              grants_used: e.grants_used,
              validity: e.validity,
            });
            expect(one.explanations.map(strip)).toEqual(
              all.explanations.filter((e) => e.item_id === item.id).map(strip),
            );
            expect(one.event.item_ids).toEqual(expected.map((i) => i.id));
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(BY_ID) },
    );
    expect(returned, "by-id reads that returned an item").toBeGreaterThan(RUNS / 10);
  }, 120_000);

  const SCOPES = "a listed scope is a readable member scope or the scope of an item a grant admits";
  test(SCOPES, async () => {
    let viaGrant = 0;
    await fc.assert(
      fc.asyncProperty(
        arbHonouring,
        arbActor,
        arbScenario,
        arbInstant,
        async (policy, reader, { pool, bridge }, at) => {
          const items = shaped(pool, bridge, reader);
          const plane = await planeWith(policy, items, "2026-10-01T00:00:00Z");
          const { scopes } = await plane.listScopes(reader, at);
          const read = await plane.read(reader, { at });
          const members = [
            ...new Set(reader.memberships.filter((s) => readableScope(policy, reader, s))),
          ];
          const granted = [
            ...new Set(read.items.filter((i) => !members.includes(i.scope)).map((i) => i.scope)),
          ];
          const expected = [
            ...members.map((scope) => ({ scope, via: "membership" })),
            ...granted.map((scope) => ({ scope, via: "grant" })),
          ].sort((a, b) => (a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : 0));
          expect(scopes).toEqual(expected);
          viaGrant += granted.length;
        },
      ),
      { numRuns: RUNS, seed: seedFor(SCOPES) },
    );
    expect(viaGrant, "scopes listed through a grant").toBeGreaterThan(RUNS / 20);
  }, 120_000);
});
