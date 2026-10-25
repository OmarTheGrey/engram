// Integration tests of Plane.write on the fake adapter (card E2.3): the gate
// runs before the store, an allowed write lands with its store_ref, a denied
// one leaves exactly one event and never reaches the adapter.
import { describe, expect, test } from "vitest";
import { currentItems } from "../../../src/events.ts";
import { itemByStoreRef } from "../../../src/items.ts";
import { SCHEMA_ID, SOURCE_ISOLATION_ID } from "../../../src/policy/evaluate.ts";
import type { MemoryItem } from "../../../src/schema.ts";
import { AT, fresh, id, item, testPolicy } from "./helpers.ts";

const writer = { id: "person:omar", level: "team" as const, memberships: ["team:platform"] };

describe("Plane.write", () => {
  test("lands an allowed write in the store and records its store_ref in the event", async () => {
    const { plane, adapter, db } = fresh();
    const { item: stored, event } = await plane.write(writer, item(1), AT);
    expect(adapter.writes).toBe(1);
    expect(stored?.store_ref).toEqual({ adapter: "fake", key: id(1) });
    expect(event).toMatchObject({
      op: "write",
      decision: "allow",
      item_id: id(1),
      actor: "person:omar",
      scope_from: null,
      scope_to: "team:platform",
      policy_id: "test/write/team",
      ts: AT,
    });
    expect(event.item).toEqual(stored);
    expect(itemByStoreRef(db, { adapter: "fake", key: id(1) })).toEqual(stored);
    expect(stored && (await adapter.read(stored.store_ref ?? { adapter: "", key: "" }))).toEqual(
      stored,
    );
  });

  test("denies a forbidden-class write without calling the adapter, with one event", async () => {
    const { plane, adapter, db } = fresh();
    const { item: stored, event } = await plane.write(writer, item(1, { class: "episodic" }), AT);
    expect(stored).toBeNull();
    expect(adapter.writes).toBe(0);
    expect(plane.events()).toEqual([event]);
    expect(event).toMatchObject({
      op: "write",
      decision: "deny",
      item_id: id(1),
      scope_to: "team:platform",
      policy_id: "test/write/team",
    });
    expect(event.reason).toMatch(/episodic/);
    expect(event.item).toBeUndefined();
    expect(currentItems(db)).toEqual([]);
  });

  test("denies a source the rule does not list, and a confidence below the floor", async () => {
    const { plane, adapter } = fresh();
    const a = await plane.write(writer, item(1, { kind: "tool" }), AT);
    const b = await plane.write(writer, item(2, { confidence: 0.1 }), AT);
    expect([a.event.decision, b.event.decision]).toEqual(["deny", "deny"]);
    expect(a.event.reason).toMatch(/source tool/);
    expect(b.event.reason).toMatch(/floor/);
    expect(adapter.writes).toBe(0);
  });

  test("denies model content outside person scope under the source-isolation rule", async () => {
    const { plane, adapter } = fresh();
    const { event } = await plane.write(writer, item(1, { kind: "model" }), AT);
    expect(event).toMatchObject({ decision: "deny", policy_id: SOURCE_ISOLATION_ID });
    expect(adapter.writes).toBe(0);
    const person = await plane.write(writer, item(2, { kind: "model", scope: "person:omar" }), AT);
    expect(person.event.decision).toBe("allow");
  });

  test("denies a write to a level with no rule", async () => {
    const policy = testPolicy();
    const { plane } = fresh({ ...policy, write: policy.write.filter((r) => r.scope !== "role") });
    const { event } = await plane.write(writer, item(1, { scope: "role:lead" }), AT);
    expect(event).toMatchObject({ decision: "deny", policy_id: "test/write/role" });
  });

  test("lands a write to a scope that requires review as a candidate, decision allow", async () => {
    const { plane, adapter } = fresh();
    const { item: stored, event } = await plane.write(writer, item(1, { scope: "org" }), AT);
    expect(event.decision).toBe("allow");
    expect(stored?.status).toBe("candidate");
    expect(event.item?.status).toBe("candidate");
    expect((await adapter.list("org")).map((i) => i.status)).toEqual(["candidate"]);
    expect(event.reason).toMatch(/review/);
  });

  test("ignores a store_ref the caller supplied and records the adapter's", async () => {
    const { plane } = fresh();
    const forged = item(1, { store_ref: { adapter: "elsewhere", key: "k" } });
    const { item: stored } = await plane.write(writer, forged, AT);
    expect(stored?.store_ref).toEqual({ adapter: "fake", key: id(1) });
  });

  test("denies an item that fails the schema with one event naming the schema rule", async () => {
    const { plane, adapter } = fresh();
    const bad = { ...item(1), confidence: 2 } as MemoryItem;
    const { item: stored, event } = await plane.write(writer, bad, AT);
    expect(stored).toBeNull();
    expect(adapter.writes).toBe(0);
    expect(event).toMatchObject({ decision: "deny", policy_id: SCHEMA_ID, item_id: id(1) });
    expect(event.reason).toMatch(/confidence/);
    expect(plane.events()).toHaveLength(1);
  });

  test("records null item_id and scope_to when the invalid item's id and scope are invalid", async () => {
    const { plane } = fresh();
    const bad = { ...item(1), id: "not-a-uuid", scope: "nowhere" } as MemoryItem;
    const { event } = await plane.write(writer, bad, AT);
    expect(event).toMatchObject({ decision: "deny", item_id: null, scope_to: null });
  });

  test("records a non-object item as a schema denial", async () => {
    const { plane } = fresh();
    const { event } = await plane.write(writer, null as unknown as MemoryItem, AT);
    expect(event).toMatchObject({ decision: "deny", policy_id: SCHEMA_ID, item_id: null });
  });

  test("propagates an adapter failure and appends no event", async () => {
    const { plane, adapter } = fresh();
    adapter.write = async () => {
      throw new Error("store down");
    };
    await expect(plane.write(writer, item(1), AT)).rejects.toThrow(/store down/);
    expect(plane.events()).toEqual([]);
  });

  test("the same writes on a fresh plane give the same events", async () => {
    const run = async () => {
      const { plane } = fresh();
      for (const it of [item(1), item(2, { class: "episodic" }), item(3, { scope: "org" })])
        await plane.write(writer, it, AT);
      return plane.events();
    };
    expect(await run()).toEqual(await run());
  });
});
