// The append-only event log is the source of truth; the items table is a
// projection of it (ADR 0003). appendEvent updates the projection in the same
// transaction; rebuild() recomputes it from the log alone, and the replay test
// requires the two to agree. Nothing here reads the clock: callers supply ids
// and timestamps.
import type { Db, Row } from "./db/db.ts";
import { type MemoryEvent, MemoryEvent as MemoryEventSchema, type MemoryItem } from "./schema.ts";

export type EventInput = Omit<MemoryEvent, "seq">;

const CHANGES_ITEM = new Set(["write", "update", "promote"]);
const RETIRES_ITEM = new Set(["retire", "evict"]);

function project(db: Db, event: MemoryEvent): void {
  if (event.decision !== "allow") return;
  if (CHANGES_ITEM.has(event.op) && event.item) {
    db.prepare(
      "INSERT INTO items (id, status, body) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET status = excluded.status, body = excluded.body",
    ).run(event.item.id, event.item.status, JSON.stringify(event.item));
    return;
  }
  if (RETIRES_ITEM.has(event.op) && event.item_id) {
    const row = db.prepare("SELECT body FROM items WHERE id = ?").get(event.item_id);
    if (!row) return;
    const retired = { ...(JSON.parse(String(row.body)) as MemoryItem), status: "retired" as const };
    db.prepare("UPDATE items SET status = 'retired', body = ? WHERE id = ?").run(
      JSON.stringify(retired),
      event.item_id,
    );
  }
}

/** Validates the event, assigns the next dense seq, stores it and updates the projection. */
export function appendEvent(db: Db, input: EventInput): MemoryEvent {
  return db.transaction(() => {
    const next = db.prepare("SELECT coalesce(max(seq) + 1, 0) AS seq FROM events").get();
    const event = MemoryEventSchema.parse({ ...input, seq: Number(next?.seq ?? 0) });
    db.prepare(
      "INSERT INTO events (seq, id, op, item_id, actor, scope_from, scope_to, decision, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      event.seq,
      event.id,
      event.op,
      event.item_id,
      event.actor,
      event.scope_from,
      event.scope_to,
      event.decision,
      JSON.stringify(event),
    );
    project(db, event);
    return event;
  });
}

const parse = (rows: Row[]) => rows.map((r) => JSON.parse(String(r.body)) as MemoryEvent);

export function allEvents(db: Db): MemoryEvent[] {
  return parse(db.prepare("SELECT body FROM events ORDER BY seq").all());
}

export function eventsByItem(db: Db, itemId: string): MemoryEvent[] {
  return parse(db.prepare("SELECT body FROM events WHERE item_id = ? ORDER BY seq").all(itemId));
}

export function eventsByActor(db: Db, actor: string): MemoryEvent[] {
  return parse(db.prepare("SELECT body FROM events WHERE actor = ? ORDER BY seq").all(actor));
}

/** Events whose source or target scope is `scope`. */
export function eventsByScope(db: Db, scope: string): MemoryEvent[] {
  return parse(
    db
      .prepare("SELECT body FROM events WHERE scope_from = ? OR scope_to = ? ORDER BY seq")
      .all(scope, scope),
  );
}

/** The projected items, ordered by id. */
export function currentItems(db: Db): MemoryItem[] {
  return db
    .prepare("SELECT body FROM items ORDER BY id")
    .all()
    .map((r) => JSON.parse(String(r.body)) as MemoryItem);
}

/** Recomputes the item projection from the event log alone. */
export function rebuild(db: Db): void {
  db.transaction(() => {
    db.exec("DELETE FROM items");
    for (const event of allEvents(db)) project(db, event);
  });
}
