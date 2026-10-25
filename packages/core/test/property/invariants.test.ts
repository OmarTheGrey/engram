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
// Invariant 1 stores its items under ADMIT_ALL, by a writer who is a member of
// every item's scope, and reads them under the random policy. The read filter
// decides item by item, so a store holding every item a random write policy
// would admit, and more, can only find more counterexamples; with the random
// policy on both sides almost no write lands and the reads come back empty.
// For the same reason half the readers are also made members of some of the
// items' scopes. Reads run with and without query text, on a store with and
// without search (finding R5-2), at instants that collide with grant expiries
// (finding R5-11). Guards fail the test unless the run admitted an item by
// scope and one by grant, excluded a stored item by scope and one by a
// grant's class or expiry, and met a grant expiring exactly at the read time,
// so the property cannot pass vacuously.
//
// Invariant 2's oracle also forbids a write by a non-member of the item's
// scope and a write carrying a grant the gate refuses (decision D4 of the
// review fix pass); writers sometimes carry a harness-set source, which the
// oracle judges instead of the item's claimed provenance.
import { createFakeAdapter } from "@engram/adapters";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { currentItems, rebuild } from "../../src/events.ts";
import { type Actor, createPlane, type Plane } from "../../src/plane.ts";
import type { MemoryItem, Policy } from "../../src/schema.ts";
import { compareTimestamps } from "../../src/time.ts";
import {
  arbActor,
  arbGatedItem,
  arbGrantedItem,
  arbInstant,
  arbPolicy,
  arbTimestamp,
  arbWriter,
  seedFor,
} from "../generators.ts";
import { patternCovers, readable, writeForbidden } from "./oracle.ts";

const RUNS = 1000;

function freshPlane(policy: Policy, search = true) {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = createFakeAdapter({ search });
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
const uniqueGatedItems = fc.uniqueArray(arbGatedItem, { selector: (i) => i.id, maxLength: 6 });

/** `actor`, made a member of a subset of `scopes` as well. */
const joining = (actor: fc.Arbitrary<Actor>, scopes: string[]) =>
  fc.tuple(actor, fc.subarray(scopes)).map(([a, extra]) => ({
    ...a,
    memberships: [...new Set([...a.memberships, ...extra])],
  }));

/**
 * Items and an actor who is, in half the cases, also a member of some of the
 * items' scopes, so that reads by scope (and writes by members) are exercised.
 */
const itemsAnd = (items: fc.Arbitrary<MemoryItem[]>, actor: fc.Arbitrary<Actor>) =>
  items.chain((list) => {
    const scopes = [...new Set(list.map((i) => i.scope))];
    return fc.tuple(fc.constant(list), fc.oneof(actor, joining(actor, scopes)));
  });

/** Query text: none, a word of one of the items, or a word none of them has. */
const arbText = (items: MemoryItem[]) => {
  const words = items.flatMap((i) =>
    (typeof i.content === "string" ? i.content : JSON.stringify(i.content))
      .split(/\s+/)
      .filter(Boolean),
  );
  // No text in half the cases, so every stored item is a candidate.
  const options = [
    { arbitrary: fc.constant<string | undefined>(undefined), weight: 3 },
    { arbitrary: fc.constant<string | undefined>("no-item-has-this-word"), weight: 1 },
  ];
  if (words.length > 0)
    options.push({ arbitrary: fc.constantFrom<string | undefined>(...words), weight: 2 });
  return fc.oneof(...options);
};

/** The reader as generated, or, as often, renamed to a principal some grant names exactly. */
const namedByAGrant = (items: MemoryItem[], reader: Actor) => {
  const named = items.flatMap((i) => i.grants.map((g) => g.to)).filter((to) => !to.includes("*"));
  return named.length === 0
    ? fc.constant(reader)
    : fc.oneof(
        fc.constant(reader),
        fc.constantFrom(...named).map((id) => ({ ...reader, id })),
      );
};

/** A read time from the colliding pool, or, as often, exactly a grant's expiry or a validity start. */
const atABoundary = (items: MemoryItem[]) => {
  const edges = items.flatMap((i) => [i.valid_from, ...i.grants.flatMap((g) => g.expires ?? [])]);
  return edges.length === 0 ? arbInstant : fc.oneof(arbInstant, fc.constantFrom(...edges));
};

/** Before every generated expiry. */
const EARLY = "2026-01-01T00:00:00Z";

/**
 * One grant made the case: its item active, of the grant's class, valid from
 * the read time; the reader, when the grant names a principal, that
 * principal; the read exactly at the grant's expiry, where the grant must not
 * admit and a `>=` expiry check would (finding R5-11), or before every
 * expiry, where it admits.
 */
const onAGrant = (items: MemoryItem[], reader: Actor) => {
  const pairs = items.flatMap((item, i) => item.grants.map((_, k) => [i, k] as const));
  if (pairs.length === 0) return fc.tuple(fc.constant(items), fc.constant(reader), arbInstant);
  return fc.tuple(fc.constantFrom(...pairs), fc.boolean()).map(([[i, k], onExpiry]) => {
    const target = items[i] as MemoryItem;
    const g = target.grants[k] as MemoryItem["grants"][number];
    const at = onExpiry ? (g.expires ?? EARLY) : EARLY;
    const focused = {
      ...target,
      status: "active",
      valid_from: at,
      grants: target.grants.map((x, j) => (j === k ? { ...x, class: target.class } : x)),
    } as MemoryItem;
    const list = items.map((it, j) => (j === i ? focused : it));
    const named = g.to.includes("*") ? reader : { ...reader, id: g.to };
    return [list, named, at] as const;
  });
};

const contentOf = (i: MemoryItem) =>
  (typeof i.content === "string" ? i.content : JSON.stringify(i.content)).toLowerCase();

describe("invariants", () => {
  const I1 = "invariant 1: no read returns an item the actor's scope and grants exclude";
  test(I1, async () => {
    const seen = { byScope: 0, byGrant: 0, exclScope: 0, exclGrant: 0, expiryAtRead: 0 };
    await fc.assert(
      fc.asyncProperty(
        arbPolicy,
        arbActor,
        itemsAnd(uniqueGatedItems, arbActor)
          .chain(([items, reader]) =>
            fc.oneof(
              fc.tuple(fc.constant(items), namedByAGrant(items, reader), atABoundary(items)),
              onAGrant(items, reader),
            ),
          )
          .chain(([items, reader, at]) =>
            fc.tuple(fc.constant([items, reader, at] as const), arbText(items), fc.boolean()),
          ),
        async (policy, writer, [[items, reader, at], text, search]) => {
          const { plane, under } = freshPlane(policy, search);
          const store = under(ADMIT_ALL);
          const scopes = items.map((i) => i.scope);
          const member = { ...writer, memberships: [...new Set(scopes)] };
          for (const item of items) await store.write(member, item, at);
          const { items: read, explanations } = await plane.read(reader, { text, at });
          for (const e of explanations) seen[e.grants_used.length > 0 ? "byGrant" : "byScope"]++;
          for (const item of read) {
            expect(
              readable(policy, reader, item, at),
              `read returned ${item.id} (scope ${item.scope}) to ${reader.id} reading as ${reader.level}, member of [${reader.memberships.join(", ")}], with no admitting grant, query ${JSON.stringify(text)}`,
            ).toBe(true);
          }
          const returned = new Set(read.map((i) => i.id));
          const terms = (text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
          for (const item of items) {
            const matches = terms.every((t) => contentOf(item).includes(t));
            const live = item.status === "active" && compareTimestamps(item.valid_from, at) <= 0;
            // The boundary a `>=` expiry check gets wrong: an excluded live item whose
            // grant names the reader, for its class, and expires exactly at the read time.
            if (live && policy.read.honour_grants && !readable(policy, reader, item, at))
              for (const g of item.grants)
                if (
                  patternCovers(g.to, reader.id) &&
                  (g.class === undefined || g.class === item.class) &&
                  g.expires !== undefined &&
                  compareTimestamps(g.expires, at) === 0
                )
                  seen.expiryAtRead++;
            if (!live || !matches || returned.has(item.id) || readable(policy, reader, item, at))
              continue;
            const covered =
              policy.read.honour_grants && item.grants.some((g) => patternCovers(g.to, reader.id));
            seen[covered ? "exclGrant" : "exclScope"]++;
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(I1) },
    );
    expect(
      Object.values(seen).every((n) => n > 0),
      `the run must admit by scope and by grant, exclude by scope and by a grant's terms, and meet a grant expiring at the read time; it saw ${JSON.stringify(seen)}`,
    ).toBe(true);
  }, 120_000);

  const I2 = "invariant 2: no write lands in a scope whose policy forbids its class or source";
  test(I2, async () => {
    const seen = { landed: 0, forbidden: 0 };
    await fc.assert(
      fc.asyncProperty(
        arbPolicy,
        itemsAnd(
          arbGrantedItem.map((i) => [i]),
          arbWriter,
        ),
        arbTimestamp,
        async (policy, [[item], actor], at) => {
          if (!item) return;
          const { db, adapter, plane } = freshPlane(policy);
          const { item: stored } = await plane.write(actor, item, at);
          if (stored) seen.landed++;
          if (writeForbidden(policy, actor, item)) {
            seen.forbidden++;
            const inStore = (await adapter.list(item.scope)).map((i) => i.id);
            const projected = currentItems(db).map((i) => i.id);
            expect(
              [...inStore, ...projected],
              `${item.class === "episodic" ? "an" : "a"} ${item.class} item from source ${actor.source ?? item.provenance.kind}, with grants ${JSON.stringify(item.grants)}, written by ${actor.id} (member of [${actor.memberships.join(", ")}]), landed in ${item.scope}, which policy ${policy.id} forbids`,
            ).not.toContain(item.id);
          }
        },
      ),
      { numRuns: RUNS, seed: seedFor(I2) },
    );
    expect(
      seen.landed > 0 && seen.forbidden > 0,
      `invariant 2 needs writes that land and writes it forbids; it saw ${JSON.stringify(seen)}`,
    ).toBe(true);
  }, 120_000);

  const I3 =
    "invariant 3: every read or write appends exactly one event, and a denial carries a reason and a policy id";
  test(I3, async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPolicy,
        itemsAnd(uniqueItems, arbWriter),
        arbTimestamp,
        async (policy, [items, actor], at) => {
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
        itemsAnd(uniqueItems, arbWriter),
        arbTimestamp,
        async (policy, [items, actor], at) => {
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
