// The erasure event (card E9.7, events.ts ERASURE_ID) on replay: an allowed
// `retire` under engram/offboard/erase removes its item from the projection
// and from itemsAt, so a projection rebuilt from the log equals the
// incremental one and an erased item never comes back. The same op under any
// other rule only retires.
import { describe, expect, test } from "vitest";
import { migrate } from "../../src/db/migrate.ts";
import { openSqlite } from "../../src/db/sqlite.ts";
import {
  allEvents,
  appendEvent,
  currentItems,
  ERASURE_ID,
  type EventInput,
  erases,
  rebuild,
} from "../../src/events.ts";
import { itemsAt } from "../../src/replay.ts";
import type { MemoryItem } from "../../src/schema.ts";

const id = (n: number) => `01980000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const AT = "2026-10-25T12:00:00.000Z";
const item = (n: number): MemoryItem =>
  ({
    id: id(n),
    class: "semantic",
    scope: "person:dana",
    owner: "person:dana",
    content: `fact ${n}`,
    provenance: { kind: "user", ref: "r", hash: `sha256:${"0".repeat(64)}`, actor: "person:dana" },
    confidence: 0.9,
    valid_from: AT,
    valid_to: null,
    ttl: null,
    grants: [],
    version: 1,
    lineage: [],
    status: "active",
    store_ref: { adapter: "fake", key: `k${n}` },
    schema_version: 1,
  }) as MemoryItem;

let e = 100;
const event = (over: Partial<EventInput>): EventInput => ({
  id: id(e++),
  ts: AT,
  op: "write",
  item_id: null,
  actor: "person:dana",
  scope_from: null,
  scope_to: "person:dana",
  decision: "allow",
  reason: "r",
  policy_id: "p/write/person",
  schema_version: 1,
  ...over,
});

function log() {
  const db = openSqlite(":memory:");
  migrate(db);
  appendEvent(db, event({ item_id: id(1), item: item(1) }));
  appendEvent(db, event({ item_id: id(2), item: item(2) }));
  appendEvent(db, event({ op: "retire", item_id: id(1), policy_id: ERASURE_ID, scope_to: null }));
  appendEvent(
    db,
    event({ op: "retire", item_id: id(2), policy_id: "p/retention/x", scope_to: null }),
  );
  return db;
}

describe("an erasure event on replay", () => {
  test("removes its item from the projection; another retire only retires", () => {
    const db = log();
    expect(currentItems(db).map((i) => [i.id, i.status])).toEqual([[id(2), "retired"]]);
  });

  test("the projection rebuilt from the log equals the incremental one", () => {
    const db = log();
    const incremental = currentItems(db);
    rebuild(db);
    expect(currentItems(db)).toEqual(incremental);
  });

  test("itemsAt drops the item from the erasure on, and holds it before", () => {
    const db = log();
    expect(itemsAt(db, 1).map((i) => i.id)).toEqual([id(1), id(2)]);
    expect(itemsAt(db, 2).map((i) => i.id)).toEqual([id(2)]);
    expect(itemsAt(db, 3)).toEqual(currentItems(db));
  });

  test("only an allowed retire under the erasure rule erases", () => {
    const events = allEvents(log());
    expect(events.map(erases)).toEqual([false, false, true, false]);
    const denied = { ...(events[2] as (typeof events)[number]), decision: "deny" as const };
    expect(erases(denied)).toBe(false);
    expect(erases({ ...(events[2] as (typeof events)[number]), op: "evict" })).toBe(false);
  });
});
