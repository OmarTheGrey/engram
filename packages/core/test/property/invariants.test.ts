// The invariants (docs/conventions/testing.md, "The invariants are always on").
// Owned by the lead: changing this file needs a second reviewer and a
// `decision` log entry. It never has a skip.
//
// RED BY DESIGN until card E2.1 lands: the only Plane is a stub that admits
// everything, so invariants 1 and 2 fail. Tracked in
// https://github.com/OmarTheGrey/engram/issues/1. CI runs this file in its own
// job (`make test-invariants`, continue-on-error); `make test` excludes it.
//
// A failure prints the counterexample and the seed; rerun one case with
// `fc.assert(..., { seed, path })` from the report.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { currentItems, rebuild } from "../../src/events.ts";
import { type Actor, createStubPlane, type Plane } from "../../src/plane.ts";
import type { MemoryItem, Policy } from "../../src/schema.ts";
import { arbActor, arbGrantedItem, arbPolicy, arbTimestamp, seedFor } from "../generators.ts";

const RUNS = 1000;

// Oracle: what the policy permits, written independently of any Plane.

const level = (scope: string) => (scope === "org" ? "org" : scope.split(":")[0]);

function grantMatches(pattern: string, actorId: string): boolean {
  return pattern.endsWith("*") ? actorId.startsWith(pattern.slice(0, -1)) : pattern === actorId;
}

/** Invariant 1: may `actor` see `item` at time `at` under `policy`? */
export function readable(policy: Policy, actor: Actor, item: MemoryItem, at: string): boolean {
  const mayRead = policy.read.matrix.find((r) => r.reader === actor.level)?.may_read ?? [];
  const byScope =
    actor.memberships.includes(item.scope) &&
    mayRead.includes(level(item.scope) as (typeof mayRead)[number]);
  const byGrant =
    policy.read.honour_grants &&
    item.grants.some(
      (g) =>
        grantMatches(g.to, actor.id) &&
        (g.class === undefined || g.class === item.class) &&
        (g.expires === undefined || g.expires > at),
    );
  return byScope || byGrant;
}

/** Invariant 2: does the policy forbid `item`'s class or source in its scope? */
export function writeForbidden(policy: Policy, item: MemoryItem): boolean {
  const rule = policy.write.find((r) => r.scope === level(item.scope));
  if (!rule) return false;
  return (
    rule.forbidden_classes.includes(item.class) ||
    !rule.allowed_sources.includes(item.provenance.kind)
  );
}

function freshPlane(policy: Policy) {
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const plane: Plane = createStubPlane({ db, policy, newId });
  return { db, plane };
}

const uniqueItems = fc.uniqueArray(arbGrantedItem, { selector: (i) => i.id, maxLength: 6 });

describe("invariants", () => {
  const I1 = "invariant 1: no read returns an item the actor's scope and grants exclude";
  test(I1, () => {
    fc.assert(
      fc.property(
        arbPolicy,
        arbActor,
        arbActor,
        uniqueItems,
        arbTimestamp,
        (policy, writer, reader, items, at) => {
          const { plane } = freshPlane(policy);
          for (const item of items) plane.write(writer, item, at);
          for (const item of plane.read(reader, { at }).items) {
            expect(
              readable(policy, reader, item, at),
              `read returned ${item.id} (scope ${item.scope}) to ${reader.id} reading as ${reader.level}, member of [${reader.memberships.join(", ")}], with no admitting grant`,
            ).toBe(true);
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(I1) },
    );
  });

  const I2 = "invariant 2: no write lands in a scope whose policy forbids its class or source";
  test(I2, () => {
    fc.assert(
      fc.property(arbPolicy, arbActor, arbGrantedItem, arbTimestamp, (policy, actor, item, at) => {
        const { db, plane } = freshPlane(policy);
        plane.write(actor, item, at);
        if (writeForbidden(policy, item)) {
          expect(
            currentItems(db).map((i) => i.id),
            `${item.class === "episodic" ? "an" : "a"} ${item.class} item from source ${item.provenance.kind} landed in ${item.scope}, which policy ${policy.id} forbids`,
          ).not.toContain(item.id);
        }
      }),
      { numRuns: RUNS, seed: seedFor(I2) },
    );
  });

  const I3 =
    "invariant 3: every denied read or write produced exactly one event with a reason and a policy id";
  test(I3, () => {
    fc.assert(
      fc.property(arbPolicy, arbActor, uniqueItems, arbTimestamp, (policy, actor, items, at) => {
        const { plane } = freshPlane(policy);
        const calls = [
          ...items.map((item) => () => plane.write(actor, item, at)),
          () => plane.read(actor, { at }),
        ];
        for (const call of calls) {
          const before = plane.events().length;
          const result = call();
          const added = plane.events().slice(before);
          expect(added, "each call appends exactly one event").toHaveLength(1);
          if (result.event.decision === "deny") {
            expect(added[0]).toMatchObject({ decision: "deny" });
            expect(added[0]?.reason).not.toBe("");
            expect(added[0]?.policy_id).not.toBe("");
          }
        }
      }),
      { numRuns: RUNS, seed: seedFor(I3) },
    );
  });

  const I4 =
    "invariant 4: replaying the events of any write sequence gives the same state and reads";
  test(I4, () => {
    fc.assert(
      fc.property(arbPolicy, arbActor, uniqueItems, arbTimestamp, (policy, actor, items, at) => {
        const { db, plane } = freshPlane(policy);
        for (const item of items) plane.write(actor, item, at);
        const state = currentItems(db);
        const reads = plane.read(actor, { at }).items.map((i) => i.id);
        rebuild(db);
        expect(currentItems(db)).toEqual(state);
        expect(plane.read(actor, { at }).items.map((i) => i.id)).toEqual(reads);
      }),
      { numRuns: RUNS, seed: seedFor(I4) },
    );
  });
});
