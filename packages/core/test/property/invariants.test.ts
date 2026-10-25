// The invariants (docs/conventions/testing.md, "The invariants are always on").
// Owned by the lead: changing this file needs a second reviewer and a
// `decision` log entry. It never has a skip.
//
// All four run against the real Plane (createPlane), with the read filter of
// card E2.2 and the write gate of card E2.3, under random policies. Invariants
// 1 and 2 were red by design against a stub that admitted everything until
// those cards landed (issue #1); they are now asserted directly, in `make test`
// and in `make test-invariants` alike. A failure prints the counterexample and
// the seed. Each invariant runs RUNS cases.
//
// Invariant 1 stores its items under ADMIT_ALL and reads them under the random
// policy. The read filter decides item by item, so a store holding every item
// a random write policy would admit, and more, can only find more
// counterexamples; with the random policy on both sides almost no write lands
// and the reads come back empty. For the same reason half the readers are also
// made members of some of the items' scopes. A guard fails the test unless the
// run admitted at least one item by scope and one by grant, so the property
// cannot pass vacuously.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { currentItems, rebuild } from "../../src/events.ts";
import { createPlane, type Plane } from "../../src/plane.ts";
import type { Policy } from "../../src/schema.ts";
import { arbActor, arbGrantedItem, arbPolicy, arbTimestamp, seedFor } from "../generators.ts";
import { readable, writeForbidden } from "./oracle.ts";

const RUNS = 1000;

function freshPlane(policy: Policy) {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = createFakeAdapter();
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const plane: Plane = createPlane({ db, adapter, policy, newId });
  /** A plane over the same log and store that writes under `other`. */
  const under = (other: Policy): Plane => createPlane({ db, adapter, policy: other, newId });
  return { db, adapter, plane, under };
}

/** Every class from every source at every level, no floor, no review. */
const ADMIT_ALL: Policy = {
  id: "admit-all",
  version: 1,
  write: (["person", "role", "team", "org"] as const).map((scope) => ({
    scope,
    allowed_sources: ["user", "document", "tool", "model", "import", "compaction"],
    confidence_floor: 0,
    forbidden_classes: [],
    requires_review: false,
  })),
  read: { matrix: [], honour_grants: false },
  retention: [],
  promotion: {
    episodic_to_semantic: { confirmations: 1, or_review: true },
    procedural: { replay_k: 1, replay_n: 1 },
  },
  lints: { enabled: [], thresholds: {} },
  schema_version: 0,
};

const uniqueItems = fc.uniqueArray(arbGrantedItem, { selector: (i) => i.id, maxLength: 6 });

/**
 * Items and a reader who is, in half the cases, also a member of some of the
 * items' scopes, so that reads by scope are exercised as well as reads by grant.
 */
const itemsAndReader = uniqueItems.chain((items) => {
  const scopes = [...new Set(items.map((i) => i.scope))];
  const insider = fc.tuple(arbActor, fc.subarray(scopes)).map(([actor, extra]) => ({
    ...actor,
    memberships: [...new Set([...actor.memberships, ...extra])],
  }));
  return fc.tuple(fc.constant(items), fc.oneof(arbActor, insider));
});

describe("invariants", () => {
  const I1 = "invariant 1: no read returns an item the actor's scope and grants exclude";
  test(I1, async () => {
    const admittedBy = { scope: 0, grant: 0 };
    await fc.assert(
      fc.asyncProperty(
        arbPolicy,
        arbActor,
        itemsAndReader,
        arbTimestamp,
        async (policy, writer, [items, reader], at) => {
          const { plane, under } = freshPlane(policy);
          const store = under(ADMIT_ALL);
          for (const item of items) await store.write(writer, item, at);
          const { items: read, explanations } = await plane.read(reader, { at });
          for (const e of explanations) admittedBy[e.grants_used.length > 0 ? "grant" : "scope"]++;
          for (const item of read) {
            expect(
              readable(policy, reader, item, at),
              `read returned ${item.id} (scope ${item.scope}) to ${reader.id} reading as ${reader.level}, member of [${reader.memberships.join(", ")}], with no admitting grant`,
            ).toBe(true);
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(I1) },
    );
    expect(
      admittedBy.scope > 0 && admittedBy.grant > 0,
      `reads admitted ${admittedBy.scope} items by scope and ${admittedBy.grant} by grant; invariant 1 needs both exercised`,
    ).toBe(true);
  }, 120_000);

  const I2 = "invariant 2: no write lands in a scope whose policy forbids its class or source";
  test(I2, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPolicy,
        arbActor,
        arbGrantedItem,
        arbTimestamp,
        async (policy, actor, item, at) => {
          const { db, adapter, plane } = freshPlane(policy);
          await plane.write(actor, item, at);
          if (writeForbidden(policy, item)) {
            const inStore = (await adapter.list(item.scope)).map((i) => i.id);
            const projected = currentItems(db).map((i) => i.id);
            expect(
              [...inStore, ...projected],
              `${item.class === "episodic" ? "an" : "a"} ${item.class} item from source ${item.provenance.kind} landed in ${item.scope}, which policy ${policy.id} forbids`,
            ).not.toContain(item.id);
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(I2) },
    );
  }, 120_000);

  const I3 =
    "invariant 3: every read or write appends exactly one event, and a denial carries a reason and a policy id";
  test(I3, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPolicy,
        arbActor,
        uniqueItems,
        arbTimestamp,
        async (policy, actor, items, at) => {
          const { plane } = freshPlane(policy);
          const calls = [
            ...items.map((item) => () => plane.write(actor, item, at)),
            () => plane.read(actor, { at }),
          ];
          for (const call of calls) {
            const before = plane.events().length;
            const result = await call();
            const added = plane.events().slice(before);
            expect(added, "each call appends exactly one event").toHaveLength(1);
            expect(added[0]?.id).toBe(result.event.id);
            if (result.event.decision === "deny") {
              expect(added[0]?.reason).not.toBe("");
              expect(added[0]?.policy_id).not.toBe("");
            }
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(I3) },
    );
  }, 120_000);

  const I4 =
    "invariant 4: replaying the events of any write sequence gives the same state, store and reads";
  test(I4, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPolicy,
        arbActor,
        uniqueItems,
        arbTimestamp,
        async (policy, actor, items, at) => {
          const { db, adapter, plane } = freshPlane(policy);
          for (const item of items) await plane.write(actor, item, at);
          const state = currentItems(db);
          const reads = (await plane.read(actor, { at })).items.map((i) => i.id);
          rebuild(db);
          expect(currentItems(db)).toEqual(state);
          expect((await plane.read(actor, { at })).items.map((i) => i.id)).toEqual(reads);
          for (const item of state) {
            expect(
              item.store_ref,
              `${item.id} is in the projection but not in the store`,
            ).not.toBeNull();
            if (item.store_ref) expect(await adapter.read(item.store_ref)).toEqual(item);
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(I4) },
    );
  }, 120_000);
});
