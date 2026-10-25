// Adopting what a store already holds (card E8.2 needs it for the files
// adapter): every item in a scope crosses the same write gate as Plane.write,
// an allowed one is recorded with the store_ref it already has and its bytes
// are never rewritten, a denied one leaves one event, and an item the log
// already holds as it stands is left alone.
import { createFakeAdapter } from "@engram/adapters";
import { describe, expect, test } from "vitest";
import { migrate } from "../../../src/db/migrate.ts";
import { openSqlite } from "../../../src/db/sqlite.ts";
import { allEvents, currentItems } from "../../../src/events.ts";
import { adoptStoreItems, createPlane } from "../../../src/plane.ts";
import { AT, counting, id, item, testPolicy } from "./helpers.ts";

const owner = { id: "person:omar", level: "person" as const, memberships: ["person:omar"] };

async function seeded() {
  const inner = createFakeAdapter();
  // Memories that were in the store before the plane governed it.
  await inner.write(item(1, { scope: "person:omar" }));
  await inner.write(item(2, { scope: "person:omar", class: "episodic" }));
  await inner.write(item(3, { scope: "team:platform" }));
  const adapter = counting(inner);
  const db = openSqlite(":memory:");
  migrate(db);
  let n = 0;
  const deps = { db, adapter, policy: testPolicy(), newId: () => id(900_000 + ++n) };
  return { deps, adapter, db, plane: createPlane(deps) };
}

describe("adoptStoreItems", () => {
  test("gates every item in the scope and adopts the allowed ones without rewriting them", async () => {
    const { deps, adapter, db } = await seeded();
    const report = await adoptStoreItems(deps, owner, "person:omar", AT);

    expect(report).toMatchObject({ listed: 2, allowed: 1, denied: 1, unchanged: 0 });
    expect(adapter.writes).toBe(0);
    expect(currentItems(db).map((i) => [i.id, i.store_ref])).toEqual([
      [id(1), { adapter: "fake", key: id(1) }],
    ]);
  });

  test("records every decision as one event with its reason and policy id", async () => {
    const { deps, db } = await seeded();
    const report = await adoptStoreItems(deps, owner, "person:omar", AT);

    const events = allEvents(db);
    expect(events.map((e) => [e.item_id, e.op, e.decision])).toEqual([
      [id(1), "write", "allow"],
      [id(2), "write", "deny"],
    ]);
    expect(report.denials).toEqual([
      { item_id: id(2), reason: events[1]?.reason, policy_id: events[1]?.policy_id },
    ]);
    expect(events[1]?.policy_id).toBe("test/write/person");
  });

  test("leaves items outside the scope alone", async () => {
    const { deps, db } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    expect(currentItems(db).some((i) => i.scope === "team:platform")).toBe(false);
  });

  test("a second run finds the adopted item unchanged and appends no event for it", async () => {
    const { deps, db } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    const before = allEvents(db).length;

    const again = await adoptStoreItems(deps, owner, "person:omar", AT);

    expect(again).toMatchObject({ listed: 2, allowed: 0, denied: 1, unchanged: 1 });
    expect(allEvents(db).length).toBe(before + 1);
  });

  test("adopted items are readable through Plane.read like any other", async () => {
    const { deps, plane } = await seeded();
    await adoptStoreItems(deps, owner, "person:omar", AT);
    const { items } = await plane.read(owner, { at: AT });
    expect(items.map((i) => i.id)).toEqual([id(1)]);
  });
});
