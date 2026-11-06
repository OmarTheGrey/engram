// Migration 4 (schema version 1) on every backend: a version 0 log, as
// migrations 1 to 3 left it, is upgraded in place. Every stored event, item,
// explanation and carried item says version 1, each read event gets the ids it
// returned in rank order from its explanation rows, and the upgraded log
// parses under the version 1 schema.
import { expect, test } from "vitest";
import type { Db } from "../../src/db/db.ts";
import { MIGRATIONS, migrate } from "../../src/db/migrate.ts";
import { Explanation, MemoryEvent, MemoryItem } from "../../src/schema.ts";
import { forEachBackend } from "./backends.ts";

const id = (n: number) => `01970000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const AT = "2026-10-25T12:00:00.000Z";

const v0Item = (n: number) => ({
  id: id(n),
  class: "semantic",
  scope: "person:omar",
  owner: "person:omar",
  content: `fact ${n}`,
  provenance: { kind: "user", ref: "r", hash: `sha256:${"0".repeat(64)}`, actor: "person:omar" },
  confidence: 0.9,
  valid_from: AT,
  valid_to: null,
  ttl: null,
  grants: [],
  version: 1,
  lineage: [],
  status: "active",
  store_ref: { adapter: "fake", key: `k${n}` },
  schema_version: 0,
});

const v0Event = (seq: number, op: string, body: Record<string, unknown>) => ({
  id: id(100 + seq),
  seq,
  ts: AT,
  op,
  item_id: null,
  actor: "person:omar",
  scope_from: null,
  scope_to: null,
  decision: "allow",
  reason: "recorded under version 0",
  policy_id: "preset.medium/read/person",
  schema_version: 0,
  ...body,
});

/** A version 0 log: two writes, a read that returned item 2 then item 1, and an empty read. */
function versionZeroLog(db: Db) {
  migrate(
    db,
    MIGRATIONS.filter((m) => m.id <= 3),
  );
  const events = [
    v0Event(0, "write", { item_id: id(1), scope_to: "person:omar", item: v0Item(1) }),
    v0Event(1, "write", { item_id: id(2), scope_to: "person:omar", item: v0Item(2) }),
    v0Event(2, "read", {}),
    v0Event(3, "read", {}),
  ];
  const insert = db.prepare(
    "INSERT INTO events (seq, id, op, item_id, actor, scope_from, scope_to, decision, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const e of events)
    insert.run(
      e.seq,
      e.id,
      e.op,
      e.item_id,
      e.actor,
      e.scope_from,
      e.scope_to,
      e.decision,
      JSON.stringify(e),
    );
  for (const n of [1, 2])
    db.prepare(
      "INSERT INTO items (id, status, body, store_adapter, store_key, seq) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(id(n), "active", JSON.stringify(v0Item(n)), "fake", `k${n}`, n - 1);
  // The read at seq 2 returned item 2 at rank 1 and item 1 at rank 2.
  for (const [rank, n] of [
    [1, 2],
    [2, 1],
  ] as const)
    db.prepare("INSERT INTO explanations (read_id, rank, item_id, body) VALUES (?, ?, ?, ?)").run(
      id(102),
      rank,
      id(n),
      JSON.stringify({
        item_id: id(n),
        rank,
        score: { total: 1, components: { relevance: 1 } },
        policy_id: "preset.medium/read/person",
        grants_used: [],
        validity: { at: AT, valid_from: AT, valid_to: null },
        schema_version: 0,
      }),
    );
}

const bodies = (db: Db, table: string) =>
  db
    .prepare(`SELECT body FROM ${table} ORDER BY body`)
    .all()
    .map((r) => JSON.parse(String(r.body)) as Record<string, unknown>);

forEachBackend((backend) => {
  test("migration 4 upgrades a version 0 log to schema version 1", () => {
    const db = backend.open();
    versionZeroLog(db);
    expect(migrate(db)).toEqual([4]);

    const events = db
      .prepare("SELECT body FROM events ORDER BY seq")
      .all()
      .map((r) => MemoryEvent.parse(JSON.parse(String(r.body))));
    expect(events.map((e) => e.schema_version)).toEqual([1, 1, 1, 1]);
    expect(events.map((e) => e.item?.schema_version ?? null)).toEqual([1, 1, null, null]);
    // The read's item ids are its explanation rows in rank order; a read that
    // returned nothing gets an empty list; writes get none.
    expect(events.map((e) => e.item_ids)).toEqual([undefined, undefined, [id(2), id(1)], []]);

    for (const item of bodies(db, "items")) expect(MemoryItem.parse(item).schema_version).toBe(1);
    for (const e of bodies(db, "explanations")) expect(Explanation.parse(e).schema_version).toBe(1);
    db.close();
  });

  test("migration 4 leaves every other field as it was", () => {
    const db = backend.open();
    versionZeroLog(db);
    const before = bodies(db, "events");
    migrate(db);
    const strip = (e: Record<string, unknown>) => {
      const { schema_version: _v, item_ids: _ids, item, ...rest } = e;
      const { schema_version: _iv, ...itemRest } = (item ?? {}) as Record<string, unknown>;
      return { ...rest, item: itemRest };
    };
    const byId = (es: Record<string, unknown>[]) =>
      [...es].sort((a, b) => String(a.id).localeCompare(String(b.id))).map(strip);
    expect(byId(bodies(db, "events"))).toEqual(byId(before));
    db.close();
  });
});
