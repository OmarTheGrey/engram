// Acceptance for card E1.2: an item round-trips through the projection keyed by
// its store_ref, and the lineage walk returns its ancestors, nearest first.
import { createFakeAdapter } from "@engram/adapters";
import { beforeEach, describe, expect, test } from "vitest";
import type { Db } from "../../src/db/db.ts";
import { MIGRATIONS, migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import { allEvents, appendEvent, rebuild } from "../../src/events.ts";
import { itemById, itemByStoreRef, lineage } from "../../src/items.ts";
import { createPlane } from "../../src/plane.ts";
import { loadPreset } from "../../src/policy/load.ts";
import type { MemoryItem } from "../../src/schema.ts";

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
    const plane = createPlane({
      db,
      adapter: createFakeAdapter(),
      policy: loadPreset("medium"),
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

  // Decision D1 of the review fix pass: a new version is a new item id under
  // the same ref (Adapter.history), and a retired item keeps its ref, so a ref
  // may have several holders. itemByStoreRef returns the newest active
  // version: an active holder that no other active holder's lineage
  // supersedes, the highest seq breaking ties (review round 2, finding N1);
  // else the latest holder.
  const K1 = { adapter: "fake", key: "k1" };

  test("several versions of an item live under one store_ref; the latest active one is returned", () => {
    put(db, item(1));
    put(db, item(2, { version: 2, lineage: [id(1)], store_ref: K1 }));
    put(db, item(3, { version: 3, lineage: [id(2), id(1)], store_ref: K1 }));
    expect(allEvents(db)).toHaveLength(3);
    expect(itemByStoreRef(db, K1)?.id).toBe(id(3));
    expect([1, 2, 3].map((n) => itemById(db, id(n))?.store_ref)).toEqual([K1, K1, K1]);
  });

  test("an active holder is preferred over a retired holder written later", () => {
    put(db, item(1));
    put(db, item(2, { version: 2, lineage: [id(1)], store_ref: K1 }));
    retire(db, id(2));
    expect(itemByStoreRef(db, K1)?.id).toBe(id(1));
  });

  test("a candidate holder counts as not retired", () => {
    put(db, item(1));
    put(db, item(2, { version: 2, lineage: [id(1)], store_ref: K1, status: "candidate" }));
    expect(itemByStoreRef(db, K1)?.id).toBe(id(2));
  });

  test("a retired holder keeps its ref, and a new item may take the ref", () => {
    put(db, item(1));
    retire(db, id(1));
    put(db, item(2, { store_ref: K1 }));
    expect(itemByStoreRef(db, K1)?.id).toBe(id(2));
    expect(itemById(db, id(1))?.store_ref).toEqual(K1);
  });

  test("when every holder is retired, the latest holder is returned", () => {
    put(db, item(1));
    put(db, item(2, { version: 2, lineage: [id(1)], store_ref: K1 }));
    retire(db, id(2));
    retire(db, id(1));
    expect(itemByStoreRef(db, K1)?.id).toBe(id(1));
  });

  test("updating a superseded version in place does not make it the holder (N1)", () => {
    put(db, item(1));
    put(db, item(2, { version: 2, lineage: [id(1)], store_ref: K1 }));
    put(db, item(1, { valid_to: "2026-10-26T09:00:00Z" }), "update");
    expect(itemById(db, id(1))?.valid_to).toBe("2026-10-26T09:00:00Z");
    expect(itemByStoreRef(db, K1)?.id).toBe(id(2));
  });

  test("rewriting the newest version in place keeps it the holder, with its new content", () => {
    put(db, item(1));
    put(db, item(2, { version: 2, lineage: [id(1)], store_ref: K1 }));
    put(
      db,
      item(2, { version: 2, lineage: [id(1)], store_ref: K1, content: "fact 2, corrected" }),
      "update",
    );
    expect(itemByStoreRef(db, K1)?.content).toBe("fact 2, corrected");
  });

  test("supersession follows lineage through a version that names only its parent", () => {
    put(db, item(1));
    put(db, item(2, { version: 2, lineage: [id(1)], store_ref: K1 }));
    put(db, item(3, { version: 3, lineage: [id(2)], store_ref: K1 }));
    retire(db, id(2));
    put(db, item(1, { content: "fact 1, touched" }), "update");
    expect(itemByStoreRef(db, K1)?.id).toBe(id(3));
  });

  test("a retired version's lineage supersedes nothing", () => {
    put(db, item(1));
    put(db, item(4, { store_ref: K1 }));
    put(db, item(2, { version: 2, lineage: [id(1)], store_ref: K1 }));
    retire(db, id(2));
    put(db, item(1, { content: "fact 1, touched" }), "update");
    // Item 1 is superseded only by a retired version, so it competes with the
    // unrelated item 4 on seq, and wins.
    expect(itemByStoreRef(db, K1)?.id).toBe(id(1));
  });

  test("between active holders that do not supersede each other, the highest seq wins", () => {
    put(db, item(2, { store_ref: K1 }));
    put(db, item(1));
    expect(itemByStoreRef(db, K1)?.id).toBe(id(1));
    put(db, item(2, { store_ref: K1, content: "fact 2, touched" }), "update");
    expect(itemByStoreRef(db, K1)?.id).toBe(id(2));
  });

  test("a lineage cycle among active holders falls back to the highest seq", () => {
    put(db, item(1, { lineage: [id(2)] }));
    put(db, item(2, { lineage: [id(1)], store_ref: K1 }));
    expect(itemByStoreRef(db, K1)?.id).toBe(id(2));
    put(db, item(1, { lineage: [id(2)], content: "fact 1, touched" }), "update");
    expect(itemByStoreRef(db, K1)?.id).toBe(id(1));
  });

  test("the holder chosen under a shared ref survives a rebuild from the log", () => {
    put(db, item(1));
    put(db, item(2, { version: 2, lineage: [id(1)], store_ref: K1 }));
    retire(db, id(2));
    rebuild(db);
    expect(itemByStoreRef(db, K1)?.id).toBe(id(1));
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
    expect(
      migrate(
        fresh,
        MIGRATIONS.filter((m) => m.id <= 2),
      ),
    ).toEqual([2]);
    expect(itemByStoreRef(fresh, { adapter: "fake", key: "k1" })).toEqual(it);
    fresh.close();
  });

  test("migration 2 accepts two items projected under one ref and orders them by their events", () => {
    const fresh = openSqlite(":memory:");
    migrate(
      fresh,
      MIGRATIONS.filter((m) => m.id === 1),
    );
    const v1 = item(1);
    const v2 = item(2, { store_ref: K1 });
    // Neither supersedes the other and item 2 was written first in the log,
    // so seq, not id, must decide.
    [v2, v1].forEach((it, s) => {
      fresh
        .prepare(
          "INSERT INTO events (seq, id, op, item_id, actor, decision, body) VALUES (?, ?, 'write', ?, 'agent:pi', 'allow', '{}')",
        )
        .run(s, id(9000 + s), it.id);
      fresh
        .prepare("INSERT INTO items (id, status, body) VALUES (?, ?, ?)")
        .run(it.id, it.status, JSON.stringify(it));
    });
    expect(migrate(fresh)).toEqual([2]);
    expect(itemByStoreRef(fresh, K1)?.id).toBe(id(1));
    const index = fresh.prepare("PRAGMA index_list(items)").all();
    expect(index.find((i) => i.name === "items_store_ref")?.unique).toBe(0);
    fresh.close();
  });

  // Review round 2, finding N3: the backfill must take, for each item, the seq
  // of its last allowed event that changed it, over a history of several
  // events, so that taking the first event, counting denials or counting
  // reads each gives a different answer.
  test("migration 2 backfills seq from each item's last allowed changing event", () => {
    const fresh = openSqlite(":memory:");
    migrate(
      fresh,
      MIGRATIONS.filter((m) => m.id === 1),
    );
    const a = item(1, { store_ref: K1 });
    const b = item(2, { store_ref: K1 });
    const c = item(3, { store_ref: K1, status: "retired" });
    const history: [string, string, "allow" | "deny"][] = [
      ["write", a.id, "allow"], // 0
      ["write", b.id, "allow"], // 1
      ["write", c.id, "allow"], // 2
      ["update", a.id, "allow"], // 3: a's last allowed change
      ["retire", c.id, "allow"], // 4: c's last allowed change
      ["update", b.id, "deny"], // 5: a denial after b's last allow
      ["read", b.id, "allow"], // 6: an allowed read changes nothing
      ["update", c.id, "deny"], // 7
    ];
    history.forEach(([op, itemId, decision], s) => {
      fresh
        .prepare(
          "INSERT INTO events (seq, id, op, item_id, actor, decision, body) VALUES (?, ?, ?, ?, 'agent:pi', ?, '{}')",
        )
        .run(s, id(9000 + s), op, itemId, decision);
    });
    for (const it of [a, b, c]) {
      fresh
        .prepare("INSERT INTO items (id, status, body) VALUES (?, ?, ?)")
        .run(it.id, it.status, JSON.stringify(it));
    }
    expect(migrate(fresh)).toEqual([2]);
    const seqs = Object.fromEntries(
      fresh
        .prepare("SELECT id, seq FROM items ORDER BY id")
        .all()
        .map((r) => [r.id, r.seq]),
    );
    expect(seqs).toEqual({ [a.id]: 3, [b.id]: 1, [c.id]: 4 });
    // a, the active holder last changed, holds the ref: with the first event
    // instead of the last, or with b's denial or read counted, b would.
    expect(itemByStoreRef(fresh, K1)?.id).toBe(a.id);
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
