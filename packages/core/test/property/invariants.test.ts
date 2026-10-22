// The invariants (docs/conventions/testing.md, "The invariants are always on").
// Owned by the lead: changing this file needs a second reviewer and a
// `decision` log entry. It never has a skip.
//
// Invariants 1 and 2 are RED BY DESIGN until cards E2.2 (read filter) and E2.3
// (write gate) land: the only Plane is a stub that admits everything. In
// `make test` they run as expected failures that must fail with their own
// counterexample message, so the day the real Plane lands they flip loudly.
// `make test-invariants` (ENGRAM_INVARIANTS=1) asserts them directly and
// prints the counterexample and the seed. Tracked in
// https://github.com/OmarTheGrey/engram/issues/1.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { currentItems, rebuild } from "../../src/events.ts";
import { createStubPlane, type Plane } from "../../src/plane.ts";
import type { Policy } from "../../src/schema.ts";
import { arbActor, arbGrantedItem, arbPolicy, arbTimestamp, seedFor } from "../generators.ts";
import { readable, writeForbidden } from "./oracle.ts";

const RUNS = 300;
const DIRECT = process.env.ENGRAM_INVARIANTS === "1";

function freshPlane(policy: Policy) {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = createFakeAdapter();
  let n = 0;
  const newId = () => `01920000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
  const plane: Plane = createStubPlane({ db, adapter, policy, newId });
  return { db, adapter, plane };
}

const uniqueItems = fc.uniqueArray(arbGrantedItem, { selector: (i) => i.id, maxLength: 6 });

/**
 * An invariant the stub is known to break. Under `make test` it must fail with
 * `expected`; under `make test-invariants` it is asserted directly.
 */
function redUntilPlane(name: string, card: string, expected: RegExp, run: () => Promise<void>) {
  if (DIRECT) {
    test(name, run, 120_000);
  } else {
    test(`${name} [expected to fail until ${card}, issue #1]`, async () => {
      const error = await run().then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(
        error,
        `${name} now holds: the stub was replaced, so remove redUntilPlane`,
      ).toBeInstanceOf(Error);
      // fast-check puts the failing assertion in `cause`.
      const { message, cause } = error as Error;
      expect(`${message}\n${String(cause)}`).toMatch(expected);
    }, 120_000);
  }
}

describe("invariants", () => {
  const I1 = "invariant 1: no read returns an item the actor's scope and grants exclude";
  redUntilPlane(I1, "E2.2", /with no admitting grant/, () =>
    fc.assert(
      fc.asyncProperty(
        arbPolicy,
        arbActor,
        arbActor,
        uniqueItems,
        arbTimestamp,
        async (policy, writer, reader, items, at) => {
          const { plane } = freshPlane(policy);
          for (const item of items) await plane.write(writer, item, at);
          for (const item of (await plane.read(reader, { at })).items) {
            expect(
              readable(policy, reader, item, at),
              `read returned ${item.id} (scope ${item.scope}) to ${reader.id} reading as ${reader.level}, member of [${reader.memberships.join(", ")}], with no admitting grant`,
            ).toBe(true);
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(I1) },
    ),
  );

  const I2 = "invariant 2: no write lands in a scope whose policy forbids its class or source";
  redUntilPlane(I2, "E2.3", /which policy .* forbids/, () =>
    fc.assert(
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
    ),
  );

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
