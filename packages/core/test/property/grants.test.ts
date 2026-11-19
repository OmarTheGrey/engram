// The grant-change rule (card E9.4, ADR 0034, proposed) over generated
// policies, items, actors, changes and times, through the real Plane: every
// call is exactly one `update` event with a reason and a policy id; a change
// lands exactly when an independent oracle permits it (the owner, user-sourced
// and a member of the scope, of an item not retired, removing only grants it
// carries, adding only grants the write gate accepts, unexpired and new);
// a landed change is the item with the new grants and the version plus one,
// nothing else changed; a refused one changes nothing; a refusal to an actor
// outside the item's scope names no scope. Not the lead-owned invariants
// file: its oracle's grant reading (`grantAllowed`) is imported, unchanged.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { appendEvent, currentItems } from "../../src/events.ts";
import { itemById } from "../../src/items.ts";
import { type Actor, createPlane } from "../../src/plane.ts";
import type { Grant, MemoryItem } from "../../src/schema.ts";
import { compareTimestamps } from "../../src/time.ts";
import {
  arbGatedGrant,
  arbGatedItem,
  arbGrant,
  arbInstant,
  arbPolicy,
  arbScope,
  arbWriter,
  seedFor,
} from "../generators.ts";
import { grantAllowed } from "./oracle.ts";

const RUNS = 300;
const UNTRUSTED = ["model", "compaction", "external"];

/** Grants equal field by field, the expiry as an instant: the oracle's own reading. */
const equal = (a: Grant, b: Grant) =>
  a.to === b.to &&
  a.class === b.class &&
  a.mode === b.mode &&
  (a.expires === undefined || b.expires === undefined
    ? a.expires === b.expires
    : compareTimestamps(a.expires, b.expires) === 0);

/** Whether the change may land, judged without the evaluator. */
function permitted(actor: Actor, item: MemoryItem, add: Grant[], remove: Grant[], at: string) {
  if (!actor.memberships.includes(item.scope)) return false;
  if (actor.source !== "user" || actor.id !== item.owner) return false;
  if (item.status === "retired") return false;
  if (!remove.every((g) => item.grants.some((h) => equal(g, h)))) return false;
  const kept = item.grants.filter((h) => !remove.some((g) => equal(g, h)));
  return add.every(
    (g, i) =>
      !UNTRUSTED.includes(item.provenance.kind) &&
      grantAllowed(g) &&
      compareTimestamps(g.expires as string, at) > 0 &&
      ![...kept, ...add.slice(0, i)].some((h) => equal(g, h)),
  );
}

const arbCase = fc
  .tuple(arbPolicy, arbWriter, arbGatedItem, fc.boolean(), fc.boolean(), fc.boolean(), arbScope)
  .chain(([policy, writer, base, owns, member, user, scope]) => {
    // Half the actors are user-sourced, so changes that land are common.
    const actor = {
      ...writer,
      ...(user ? { source: "user" } : {}),
      memberships: member ? [...new Set([...writer.memberships, scope])] : writer.memberships,
    } as Actor;
    const item = { ...base, scope, owner: owns ? actor.id : base.owner } as MemoryItem;
    return fc.record({
      policy: fc.constant(policy),
      actor: fc.constant(actor),
      item: fc.constant(item),
      remove: fc.subarray(item.grants),
      add: fc.array(fc.oneof(arbGatedGrant, arbGrant), { maxLength: 2 }),
      stray: fc.boolean(),
      at: arbInstant,
    });
  });

describe("grant changes", () => {
  const NAME = "a grant change is one update event and lands exactly when the oracle permits it";
  test(NAME, async () => {
    await fc.assert(
      fc.asyncProperty(arbCase, async ({ policy, actor, item, remove, add, stray, at }) => {
        // A removal the item does not carry, sometimes.
        const removals = stray && add[0] ? [...remove, add[0]] : remove;
        if (add.length + removals.length === 0) return;
        const db = openSqlite(":memory:");
        try {
          migrate(db);
          let n = 0;
          const newId = () => `01960000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
          const plane = createPlane({ db, adapter: createFakeAdapter(), policy, newId });
          // The item is projected as a past allowed write left it.
          appendEvent(db, {
            id: newId(),
            ts: "2026-01-01T00:00:00Z",
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
          const before = plane.events().length;
          const projected = currentItems(db);

          const result = await plane.changeGrants(actor, item.id, { add, remove: removals }, at);

          const events = plane.events().slice(before);
          expect(events).toEqual([result.event]);
          expect(result.event.op).toBe("update");
          expect(result.event.reason.length).toBeGreaterThan(0);
          expect(result.event.policy_id.length).toBeGreaterThan(0);
          const allowed = permitted(actor, item, add, removals, at);
          expect(result.decision).toBe(allowed ? "allow" : "deny");
          if (!actor.memberships.includes(item.scope))
            expect([result.event.scope_from, result.event.scope_to]).toEqual([null, null]);
          if (!allowed) {
            expect(currentItems(db)).toEqual(projected);
            return;
          }
          const kept = item.grants.filter((h) => !removals.some((g) => equal(g, h)));
          const now = itemById(db, item.id) as MemoryItem;
          expect({ ...now, store_ref: null }).toEqual({
            ...item,
            grants: [...kept, ...add],
            version: item.version + 1,
            store_ref: null,
          });
          expect(now.grants.every(grantAllowed)).toBe(true);
        } finally {
          db.close();
        }
      }),
      { numRuns: RUNS, seed: seedFor(NAME) },
    );
  });
});
