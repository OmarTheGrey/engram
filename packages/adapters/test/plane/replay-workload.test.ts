// Gate B criterion 3 on every store (card A2, plan docs/tasks/gate-b-plan.md,
// PR 2): a recorded workload (writes, a rewrite, denials, a budget eviction,
// a ttl retirement, a review promotion and a read) runs through the real
// Plane on every adapter in the conformance registry, and the item set
// rebuilt from the events alone (`itemsAt`) equals the projection, and what
// the store lists equals what the events say was stored. Retirements are
// events only (ADR 0010, ADR 0025): the store keeps the bytes it was given,
// so a stored item differs from its projected state in status alone, and
// only where an allowed retire or evict event says so. The events are the
// same on every store apart from the store_ref an allowed write records.
import {
  type Actor,
  createPlane,
  currentItems,
  itemsAt,
  type MemoryEvent,
  type MemoryItem,
  migrate,
  openSqlite,
  Policy,
} from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import { ADAPTERS, cleanupAdapters } from "../conformance/registry.ts";

afterAll(() => cleanupAdapters());

// Review finding R2-13: Gate B criteria 1 to 3 hold "on both stores" only
// while both real stores are registered; dropping one must fail here, not
// quietly shrink the loops in this file and in acceptance.test.ts.
test("the registry holds both of Gate B's real stores, Mem0 and Letta", () => {
  expect(ADAPTERS.map((a) => a.name)).toEqual(expect.arrayContaining(["mem0", "letta"]));
});

const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const T0 = "2026-10-25T12:00:00Z";
const LATER = "2026-10-25T14:00:00Z";
const SCOPES = ["person:omar", "team:platform", "org"];

const rule = (scope: "person" | "role" | "team" | "org", over: object = {}) => ({
  scope,
  allowed_sources: ["user", "document"],
  confidence_floor: 0.5,
  forbidden_classes: ["episodic"],
  requires_review: false,
  ...over,
});

/** Team semantic memory is capped at two active items; person episodes live an hour; org needs review. */
const POLICY = Policy.parse({
  id: "replay",
  version: 1,
  write: [
    rule("person", { forbidden_classes: [], confidence_floor: 0 }),
    rule("role"),
    rule("team"),
    rule("org", { requires_review: true }),
  ],
  read: {
    matrix: [
      { reader: "person", may_read: ["person", "role", "team", "org"] },
      { reader: "team", may_read: ["team", "org"] },
    ],
    honour_grants: true,
  },
  retention: [
    { scope: "team", class: "semantic", ttl: null, budget: 2, eviction: "recency" },
    { scope: "person", class: "episodic", ttl: 3600, budget: null, eviction: "recency" },
  ],
  promotion: {
    episodic_to_semantic: { confirmations: 3, or_review: true },
    procedural: { replay_k: 4, replay_n: 5 },
  },
  lints: { enabled: [], thresholds: {} },
  schema_version: 1,
});

const omar: Actor = { id: "person:omar", level: "person", memberships: SCOPES, source: "user" };
const sara: Actor = {
  id: "person:sara",
  level: "person",
  memberships: ["team:platform", "org"],
  source: "user",
};

function item(n: number, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: id(n),
    class: "semantic",
    scope: "team:platform",
    owner: "person:omar",
    content: `Fact number ${n}.`,
    provenance: { kind: "user", ref: "doc/1", hash: `sha256:${"0".repeat(64)}`, actor: omar.id },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 1,
    ...over,
  } as MemoryItem;
}

/** The recorded workload; each step's decision is asserted, so a drifting policy shows here. */
async function runWorkload(plane: ReturnType<typeof createPlane>) {
  const expectDecision = (e: MemoryEvent, d: MemoryEvent["decision"]) =>
    expect(e.decision, `${e.op} ${e.item_id}: ${e.reason}`).toBe(d);
  expectDecision((await plane.write(omar, item(1), T0)).event, "allow");
  expectDecision((await plane.write(omar, item(2), T0)).event, "allow");
  // A rewrite of item 1: version 2, new content, same id and store_ref.
  const rewrite = item(1, { version: 2, content: "Fact number 1, revised." });
  expectDecision((await plane.write(omar, rewrite, T0)).event, "allow");
  // Two denials: an episodic item in a team scope, and a scope the writer is not in.
  expectDecision((await plane.write(omar, item(3, { class: "episodic" }), T0)).event, "deny");
  expectDecision(
    (await plane.write(sara, item(4, { owner: sara.id, scope: "team:payments" }), T0)).event,
    "deny",
  );
  // An hour-long episode in omar's person scope.
  const episode = item(5, { class: "episodic", scope: "person:omar", ttl: 3600, valid_from: T0 });
  expectDecision((await plane.write(omar, episode, T0)).event, "allow");
  // A third team fact: over the budget of two, the least recently changed (item 2) is evicted.
  const third = await plane.write(omar, item(6), T0);
  expectDecision(third.event, "allow");
  expect(third.retention.map((e) => [e.op, e.item_id])).toEqual([["evict", id(2)]]);
  // An org fact lands as a candidate; sara reviews it to active in place.
  const org = await plane.write(omar, item(7, { scope: "org" }), T0);
  expect(org.item?.status).toBe("candidate");
  const promoted = await plane.promote(sara, id(7), "org", T0, { review: true });
  expectDecision(promoted.event, "allow");
  expect(promoted.item?.status).toBe("active");
  // Two hours later the episode is past its ttl; the sweep retires it.
  const sweep = await plane.retain(omar, "person:omar", LATER);
  expect(sweep.expired).toEqual([id(5)]);
  const read = await plane.read(omar, { at: LATER });
  expect(read.items.map((i) => i.id).sort()).toEqual([id(1), id(6), id(7)]);
}

/** What each item's last allowed item-carrying event (write, update, promote) handed the store. */
function storedByEvents(events: MemoryEvent[]): Map<string, MemoryItem> {
  const stored = new Map<string, MemoryItem>();
  for (const e of events) {
    if (e.decision === "allow" && e.item && e.item_id) stored.set(e.item_id, e.item);
  }
  return stored;
}

const byId = (a: MemoryItem, b: MemoryItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const storeNeutral = (e: MemoryEvent) =>
  e.item ? { ...e, item: { ...e.item, store_ref: { adapter: "<store>", key: "<key>" } } } : e;

describe("Gate B criterion 3: the event log reproduces a recorded workload's item set on every store", () => {
  const logs: Record<string, MemoryEvent[]> = {};

  for (const { name, factory } of ADAPTERS) {
    test(`on ${name}: events alone rebuild the projection, and the store holds what the events stored`, async () => {
      const db = openSqlite(":memory:");
      migrate(db);
      const adapter = await factory();
      let n = 0;
      const plane = createPlane({ db, adapter, policy: POLICY, newId: () => id(900_000 + ++n) });
      await runWorkload(plane);

      const events = plane.events();
      const projection = currentItems(db);
      expect(itemsAt(db, events.length - 1)).toEqual(projection);
      expect(projection.map((i) => [i.id, i.status])).toEqual([
        [id(1), "active"],
        [id(2), "retired"],
        [id(5), "retired"],
        [id(6), "active"],
        [id(7), "active"],
      ]);

      const listed = (await Promise.all(SCOPES.map((s) => adapter.list(s)))).flat().sort(byId);
      const stored = storedByEvents(events);
      expect(listed).toEqual([...stored.values()].sort(byId));

      const retiredByEvent = new Set(
        events
          .filter((e) => e.decision === "allow" && (e.op === "retire" || e.op === "evict"))
          .map((e) => e.item_id),
      );
      for (const projected of projection) {
        const inStore = listed.find((i) => i.id === projected.id);
        expect(inStore, projected.id).toBeDefined();
        expect({ ...inStore, status: projected.status }).toEqual(projected);
        if (inStore?.status !== projected.status) {
          expect(projected.status).toBe("retired");
          expect(retiredByEvent.has(projected.id)).toBe(true);
        }
      }
      logs[name] = events;
    }, 60_000);
  }

  test("the events are identical on every store apart from the store_ref", () => {
    const [first, ...rest] = ADAPTERS.map((a) => logs[a.name]?.map(storeNeutral));
    expect(first?.length).toBeGreaterThan(10);
    for (const events of rest) expect(events).toEqual(first);
  });
});
