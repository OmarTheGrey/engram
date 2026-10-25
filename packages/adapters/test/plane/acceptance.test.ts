// Cross-store acceptance for cards E2.3 and E2.2: the same writes and reads
// through the real Plane, under the medium preset, on every adapter in the
// conformance registry (the fake with and without search, open-source Mem0
// in-process, the files adapter). The decisions come from the plane alone, so
// the events are identical on every store apart from the store_ref an allowed
// write records. No adapter reaches the network.
import {
  type Actor,
  createPlane,
  loadPreset,
  type MemoryEvent,
  type MemoryItem,
  migrate,
  openSqlite,
} from "@engram/core";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ADAPTERS, cleanupAdapters } from "../conformance/registry.ts";

const AT = "2026-10-25T12:00:00Z";
const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

function item(n: number, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: id(n),
    class: "semantic",
    scope: "team:platform",
    owner: "person:omar",
    content: `fact number ${n}`,
    provenance: {
      kind: "user",
      ref: "doc/1",
      hash: `sha256:${"0".repeat(64)}`,
      actor: "person:omar",
    },
    confidence: 0.9,
    valid_from: "2026-10-01T00:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: null,
    schema_version: 0,
    ...over,
  } as MemoryItem;
}

const writer: Actor = { id: "person:omar", level: "team", memberships: ["team:platform"] };
const platform: Actor = { id: "person:sara", level: "team", memberships: ["team:platform"] };

const fetchCalls: string[] = [];
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCalls.push(String(input instanceof Request ? input.url : input));
    throw new Error("plane acceptance: network access refused");
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  cleanupAdapters();
});

async function planeOn(factory: (typeof ADAPTERS)[number]["factory"]) {
  const db = openSqlite(":memory:");
  migrate(db);
  const adapter = await factory();
  let n = 0;
  const plane = createPlane({
    db,
    adapter,
    policy: loadPreset("medium"),
    newId: () => id(900_000 + ++n),
  });
  return { plane, adapter };
}

/** An event with the store's own part, the store_ref of an allowed write, blanked. */
const storeNeutral = (e: MemoryEvent) =>
  e.item ? { ...e, item: { ...e.item, store_ref: { adapter: "<store>", key: "<key>" } } } : e;

describe("acceptance (card E2.3): a forbidden-class write is denied on every store", () => {
  const denials: Record<string, MemoryEvent[]> = {};

  for (const { name, factory } of ADAPTERS) {
    test(`on ${name}: denied, one event, nothing in the store`, async () => {
      const { plane, adapter } = await planeOn(factory);
      const episodic = item(1, { class: "episodic" });
      const { item: stored, event } = await plane.write(writer, episodic, AT);
      expect(stored).toBeNull();
      expect(event).toMatchObject({
        op: "write",
        decision: "deny",
        item_id: id(1),
        scope_to: "team:platform",
        policy_id: "preset.medium/write/team",
      });
      expect(event.reason).toMatch(/episodic items are forbidden in team scope/);
      expect(plane.events()).toEqual([event]);
      expect(await adapter.list("team:platform")).toEqual([]);
      denials[name] = plane.events();
    }, 30_000);
  }

  test("the denial events are identical on every store", () => {
    const [first, ...rest] = ADAPTERS.map((a) => denials[a.name]);
    expect(first).toHaveLength(1);
    for (const events of rest) expect(events).toEqual(first);
  });
});

describe("acceptance (card E2.2): a cross-scope read is denied on every store", () => {
  const logs: Record<string, MemoryEvent[]> = {};

  for (const { name, factory } of ADAPTERS) {
    test(`on ${name}: the other team's item does not come back and is counted`, async () => {
      const { plane } = await planeOn(factory);
      await plane.write(writer, item(1), AT);
      const other: Actor = { id: "person:ali", level: "team", memberships: ["team:payments"] };
      await plane.write(other, item(2, { scope: "team:payments" }), AT);
      const result = await plane.read(platform, { at: AT });
      expect(result.items.map((i) => i.id)).toEqual([id(1)]);
      expect(result.filtered).toBe(1);
      expect(result.event.reason).toMatch(/1 filtered \(1 by scope or grant/);
      expect(await plane.explain(result.event.id)).toEqual(result.explanations);
      logs[name] = plane.events();
    }, 30_000);
  }

  test("the events are identical on every store apart from the store_ref", () => {
    const [first, ...rest] = ADAPTERS.map((a) => logs[a.name]?.map(storeNeutral));
    expect(first).toHaveLength(3);
    for (const events of rest) expect(events).toEqual(first);
  });
});

test("no adapter attempted a network call", () => {
  expect(fetchCalls).toEqual([]);
});
