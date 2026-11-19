// The grant-change rule (card E9.4, ADR 0034, proposed) over generated
// policies, items, actors, changes and times, through the real Plane: every
// call is exactly one `update` event with a reason and a policy id; a change
// lands exactly when an independent oracle permits it (the owner, user-sourced
// and a member of the scope, of an item not retired, removing only grants it
// carries, adding only grants the write gate accepts, unexpired and new);
// a landed change is the item with the new grants and the version plus one,
// nothing else changed; a refused one changes nothing; a refusal to an actor
// who cannot read the item's scope as a member names no scope (finding M6 of
// PR #44). Coverage guards require allowed changes and every deny rule
// (finding M5). A second property holds Plane.write to the same rule: a
// rewrite that changes the grants lands only for the owner, user- or
// import-sourced, adding only grants the oracle accepts (finding I1). Not
// the lead-owned invariants file: its oracle's grant reading
// (`grantAllowed`) is imported, unchanged.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { appendEvent, currentItems } from "../../src/events.ts";
import { itemById } from "../../src/items.ts";
import { type Actor, createPlane } from "../../src/plane.ts";
import type { Grant, MemoryItem, Policy } from "../../src/schema.ts";
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

const levelOf = (scope: string) => (scope === "org" ? "org" : scope.split(":")[0]);

/** A member of the scope whose level the read matrix lets read it: the oracle's own reading. */
const readsAsMember = (policy: Policy, actor: Actor, scope: string) =>
  actor.memberships.includes(scope) &&
  (policy.read.matrix.find((r) => r.reader === actor.level)?.may_read ?? []).some(
    (l) => l === levelOf(scope),
  );

/** May `g` be added to `item` at `at`, beside `alongside`? Judged without the evaluator. */
const addable = (item: MemoryItem, g: Grant, alongside: Grant[], at: string) =>
  !UNTRUSTED.includes(item.provenance.kind) &&
  grantAllowed(g) &&
  g.class === item.class &&
  compareTimestamps(g.expires as string, at) > 0 &&
  !alongside.some((h) => equal(g, h));

/** Whether the change may land, judged without the evaluator. */
function permitted(
  policy: Policy,
  actor: Actor,
  item: MemoryItem,
  add: Grant[],
  remove: Grant[],
  at: string,
) {
  if (!readsAsMember(policy, actor, item.scope)) return false;
  if (actor.source !== "user" || actor.id !== item.owner) return false;
  if (item.status === "retired") return false;
  if (!remove.every((g) => item.grants.some((h) => equal(g, h)))) return false;
  const kept = item.grants.filter((h) => !remove.some((g) => equal(g, h)));
  return add.every((g, i) => addable(item, g, [...kept, ...add.slice(0, i)], at));
}

/** The same grants, each as often, in any order. */
function sameMultiset(a: Grant[], b: Grant[]) {
  const left = [...b];
  for (const g of a) {
    const k = left.findIndex((h) => equal(g, h));
    if (k === -1) return false;
    left.splice(k, 1);
  }
  return left.length === 0;
}

/** A fresh plane over a log where `item` is projected as a past allowed write left it. */
function seededPlane(policy: Policy, item: MemoryItem) {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const newId = () => `01960000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const plane = createPlane({ db, adapter: createFakeAdapter(), policy, newId });
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
  return { db, plane };
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
      // Gated grants, sometimes of the item's own class, so additions that land are common.
      add: fc.array(
        fc.oneof(
          arbGatedGrant.map((g) => ({ ...g, class: item.class })),
          arbGatedGrant,
          arbGrant,
        ),
        { maxLength: 2 },
      ),
      stray: fc.boolean(),
      at: arbInstant,
    });
  });

describe("grant changes", () => {
  const NAME = "a grant change is one update event and lands exactly when the oracle permits it";
  test(NAME, async () => {
    const seen: Record<string, number> = {};
    await fc.assert(
      fc.asyncProperty(arbCase, async ({ policy, actor, item, remove, add, stray, at }) => {
        // A removal the item does not carry, sometimes.
        const removals = stray && add[0] ? [...remove, add[0]] : remove;
        if (add.length + removals.length === 0) return;
        const { db, plane } = seededPlane(policy, item);
        try {
          const before = plane.events().length;
          const projected = currentItems(db);

          const result = await plane.changeGrants(actor, item.id, { add, remove: removals }, at);

          const events = plane.events().slice(before);
          expect(events).toEqual([result.event]);
          expect(result.event.op).toBe("update");
          expect(result.event.reason.length).toBeGreaterThan(0);
          expect(result.event.policy_id.length).toBeGreaterThan(0);
          const allowed = permitted(policy, actor, item, add, removals, at);
          expect(result.decision).toBe(allowed ? "allow" : "deny");
          const hidden = !readsAsMember(policy, actor, item.scope);
          seen[hidden ? "hidden" : result.event.policy_id] =
            (seen[hidden ? "hidden" : result.event.policy_id] ?? 0) + 1;
          if (hidden) {
            expect([result.event.scope_from, result.event.scope_to]).toEqual([null, null]);
            expect(result.event.reason.replace(actor.id, "")).not.toContain(item.owner);
          }
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
    const rules = [
      "engram/grant/change",
      "hidden",
      "engram/grant/owner",
      "engram/grant/source",
      "engram/grant/status",
      "engram/grant/unchanged",
      "engram/grant/expired",
      "engram/write/grant",
    ];
    expect(
      rules.every((r) => (seen[r] ?? 0) > 0),
      `the property needs allowed changes and every refusal; it saw ${JSON.stringify(seen)}`,
    ).toBe(true);
  });

  const REWRITE =
    "a rewrite through Plane.write that changes the grants lands only as the owner's grant change";
  test(REWRITE, async () => {
    const seen = { changedAllowed: 0, refusedByOwner: 0, refusedBySource: 0, keptAllowed: 0 };
    await fc.assert(
      fc.asyncProperty(arbCase, async ({ policy, actor, item, remove, add, at }) => {
        const grants = [...item.grants.filter((h) => !remove.includes(h)), ...add];
        // Write rules that admit every class and source, so only the grant rules can refuse.
        const admitting = {
          ...policy,
          write: (["person", "role", "team", "org"] as const).map((scope) => ({
            scope,
            allowed_sources: [
              "user",
              "document",
              "tool",
              "import",
              "model",
              "compaction",
              "external",
            ] as Policy["write"][number]["allowed_sources"],
            confidence_floor: 0,
            forbidden_classes: [],
            requires_review: false,
          })),
        };
        const { db, plane } = seededPlane(admitting, item);
        try {
          const before = plane.events().length;
          const rewrite = { ...item, version: item.version + 1, grants } as MemoryItem;
          const result = await plane.write(actor, rewrite, at);
          expect(plane.events().length).toBeGreaterThan(before);
          const changed = !sameMultiset(grants, item.grants);
          if (result.event.policy_id === "engram/grant/owner") seen.refusedByOwner++;
          if (result.event.policy_id === "engram/grant/source") seen.refusedBySource++;
          if (result.event.decision !== "allow") return;
          if (!changed) {
            seen.keptAllowed++;
            return;
          }
          seen.changedAllowed++;
          expect(actor.id, "only the owner changes grants by a rewrite").toBe(item.owner);
          expect(["user", "import"]).toContain(actor.source);
          const added = grants.filter((g) => !item.grants.some((h) => equal(g, h)));
          for (const g of added)
            expect(
              // The plane judges the provenance the rewriter's source sets (ADR 0004, D4).
              addable(
                {
                  ...item,
                  provenance: { ...item.provenance, kind: actor.source ?? item.provenance.kind },
                } as MemoryItem,
                g,
                grants.slice(0, grants.indexOf(g)),
                at,
              ),
              `a rewrite added ${JSON.stringify(g)} the oracle refuses`,
            ).toBe(true);
          expect(itemById(db, item.id)?.grants).toEqual(grants);
        } finally {
          db.close();
        }
      }),
      { numRuns: RUNS, seed: seedFor(REWRITE) },
    );
    expect(
      Object.values(seen).every((n) => n > 0),
      `the property needs rewrites that change the grants and land, refusals by the owner and the source rules, and rewrites keeping the grants; it saw ${JSON.stringify(seen)}`,
    ).toBe(true);
  });
});
