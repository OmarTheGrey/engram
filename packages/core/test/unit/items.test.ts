// Acceptance for card E1.2: an item round-trips through the projection keyed by
// its store_ref, and the lineage walk returns its ancestors, nearest first.
import { createFakeAdapter } from "@engram/adapters";
import { beforeEach, describe, expect, test } from "vitest";
import type { Db } from "../../src/db/db.ts";
import { MIGRATIONS, migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { allEvents, appendEvent, rebuild } from "../../src/events.ts";
import { itemById, itemByStoreRef, lineage } from "../../src/items.ts";
import { createStubPlane } from "../../src/plane.ts";
import type { MemoryItem, Policy } from "../../src/schema.ts";

const id = (n: number) => `01920000-0000-7000-8000-${String(n).padStart(12, "0")}`;

function item(n: number, over: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: id(n),
    class: "semantic",
    scope: "team:platform",
    owner: "person:omar",
    content: `fact ${n}`,
    provenance: {
      kind: "user",
      ref: "doc/1",
      hash: `sha256:${"ab".repeat(32)}`,
      actor: "person:omar",
    },
    confidence: 0.9,
    valid_from: "2026-10-25T09:00:00Z",
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: { adapter: "fake", key: `k${n}` },
    schema_version: 0,
    ...over,
  } as MemoryItem;
}

let seq = 0;
function put(db: Db, it: MemoryItem, op: "write" | "update" | "promote" = "write") {
  return appendEvent(db, {
    id: id(1000 + seq++),
    ts: "2026-10-25T09:00:00Z",
    op,
    item_id: it.id,
    actor: "agent:pi",
    scope_from: null,
    scope_to: it.scope,
    decision: "allow",
    reason: "allowed",
    policy_id: "p/write",
    item: it,
    schema_version: 0,
  });
}

function retire(db: Db, itemId: string) {
  return appendEvent(db, {
    id: id(1000 + seq++),
    ts: "2026-10-25T09:00:00Z",
    op: "retire",
    item_id: itemId,
    actor: "agent:pi",
    scope_from: "team:platform",
    scope_to: null,
    decision: "allow",
    reason: "superseded",
    policy_id: "p/retire",
    schema_version: 0,
  });
}

let db: Db;
beforeEach(() => {
  db = openSqlite(":memory:");
  migrate(db);
});

describe("item lookup", () => {
  test("an item round-trips by store_ref and by id", () => {
    const it = item(1);
    put(db, it);
    expect(itemByStoreRef(db, { adapter: "fake", key: "k1" })).toEqual(it);
    expect(itemById(db, it.id)).toEqual(it);
  });

  test("an unknown store_ref or id finds nothing", () => {
    put(db, item(1));
    expect(itemByStoreRef(db, { adapter: "fake", key: "k2" })).toBeUndefined();
    expect(itemByStoreRef(db, { adapter: "other", key: "k1" })).toBeUndefined();
    expect(itemById(db, id(2))).toBeUndefined();
  });

  test("an item written through the plane is found by the store_ref the adapter returned", async () => {
    let n = 0;
    const plane = createStubPlane({
      db,
      adapter: createFakeAdapter(),
      policy: {} as Policy,
      newId: () => id(5000 + ++n),
    });
    const actor = { id: "agent:pi", level: "team" as const, memberships: ["team:platform"] };
    const { item: stored } = await plane.write(
      actor,
      item(1, { store_ref: null }),
      "2026-10-25T09:00:00Z",
    );
    expect(stored?.store_ref).not.toBeNull();
    expect(itemByStoreRef(db, stored?.store_ref ?? { adapter: "", key: "" })).toEqual(stored);
  });

  test("a retired item is still found by its store_ref, with status retired", () => {
    put(db, item(1));
    retire(db, id(1));
    expect(itemByStoreRef(db, { adapter: "fake", key: "k1" })?.status).toBe("retired");
  });

  test("an item moved to a new store_ref is found only under the new one", () => {
    put(db, item(1));
    put(db, item(1, { store_ref: { adapter: "fake", key: "moved" } }), "update");
    expect(itemByStoreRef(db, { adapter: "fake", key: "k1" })).toBeUndefined();
    expect(itemByStoreRef(db, { adapter: "fake", key: "moved" })?.id).toBe(id(1));
  });

  test("a second item under a store_ref already held is refused and leaves the log unchanged", () => {
    put(db, item(1));
    const before = allEvents(db);
    expect(() => put(db, item(2, { store_ref: { adapter: "fake", key: "k1" } }))).toThrow();
    expect(allEvents(db)).toEqual(before);
    expect(itemById(db, id(2))).toBeUndefined();
  });

  test("lookup by store_ref survives a rebuild from the log", () => {
    put(db, item(1));
    rebuild(db);
    expect(itemByStoreRef(db, { adapter: "fake", key: "k1" })?.id).toBe(id(1));
  });

  test("migration 2 backfills store_ref for items projected before it", () => {
    const fresh = openSqlite(":memory:");
    migrate(
      fresh,
      MIGRATIONS.filter((m) => m.id === 1),
    );
    const it = item(1);
    fresh
      .prepare("INSERT INTO items (id, status, body) VALUES (?, ?, ?)")
      .run(it.id, it.status, JSON.stringify(it));
    expect(migrate(fresh)).toEqual([2]);
    expect(itemByStoreRef(fresh, { adapter: "fake", key: "k1" })).toEqual(it);
    fresh.close();
  });
});

describe("lineage walk", () => {
  test("returns every ancestor, nearest first", () => {
    put(db, item(1));
    put(db, item(2, { version: 2, lineage: [id(1)] }));
    put(db, item(3, { version: 3, lineage: [id(2), id(1)] }));
    const walk = lineage(db, id(3));
    expect(walk.ancestors.map((a) => a.id)).toEqual([id(2), id(1)]);
    expect(walk.missing).toEqual([]);
  });

  test("follows ancestors' own lineage when an item names only its parent", () => {
    put(db, item(1));
    put(db, item(2, { version: 2, lineage: [id(1)] }));
    put(db, item(3, { version: 3, lineage: [id(2)] }));
    expect(lineage(db, id(3)).ancestors.map((a) => a.id)).toEqual([id(2), id(1)]);
  });

  test("returns retired ancestors in their retired state", () => {
    put(db, item(1));
    retire(db, id(1));
    put(db, item(2, { version: 2, lineage: [id(1)] }));
    expect(lineage(db, id(2)).ancestors).toEqual([{ ...item(1), status: "retired" }]);
  });

  test("an item with no lineage has no ancestors", () => {
    put(db, item(1));
    expect(lineage(db, id(1))).toEqual({ ancestors: [], missing: [] });
  });

  test("reports an ancestor absent from the projection instead of dropping it", () => {
    put(db, item(2, { version: 2, lineage: [id(1)] }));
    expect(lineage(db, id(2))).toEqual({ ancestors: [], missing: [id(1)] });
  });

  test("terminates on a lineage cycle and never lists the item as its own ancestor", () => {
    put(db, item(1, { lineage: [id(2)] }));
    put(db, item(2, { lineage: [id(1)] }));
    expect(lineage(db, id(1)).ancestors.map((a) => a.id)).toEqual([id(2)]);
  });

  test("refuses to walk from an unknown item", () => {
    expect(() => lineage(db, id(9))).toThrow(/unknown item/);
  });
});
