// The append-only event log is the source of truth; the items table is a
// projection of it (ADR 0003). appendEvent updates the projection in the same
// transaction; rebuild() recomputes it from the log alone, and the replay test
// requires the two to agree; both go through applyEvent, the one projection
// rule. Nothing here reads the clock: callers supply ids and timestamps.
import type { Db, Row } from "./db/db.ts";
import { type MemoryEvent, MemoryEvent as MemoryEventSchema, type MemoryItem } from "./schema.ts";

export type EventInput = Omit<MemoryEvent, "seq">;

const CHANGES_ITEM = new Set(["write", "update", "promote"]);
const RETIRES_ITEM = new Set(["retire", "evict"]);

/**
 * The rule of a person-scope erasure (card E9.7, ADR 0010: the one hard
 * deletion the plane makes). An allowed `retire` event with this policy_id
 * removes its item from the projection, and replay removes it too, so an
 * erased item never comes back from the log.
 */
export const ERASURE_ID = "engram/offboard/erase";

/**
 * The clause an erase event's reason carries for an item whose store record
 * was left in a store that refuses the plane's delete: the merging content
 * hashes (content-hash.ts, the form for a blocking rule) of every version
 * erased and of the record the store still holds. Adoption refuses that
 * item's record while it holds one of them (rechecks of PR #41).
 */
export const LEFT_CONTENT_CLAUSE = "adoption refuses a store record holding the erased content";

/**
 * The erased content hashes the erase events of one item name
 * (LEFT_CONTENT_CLAUSE): the record left in the store under that id, and only
 * it, is refused while it holds them. One indexed lookup by item id.
 */
export function erasedStoreContent(db: Db, itemId: string): Set<string> {
  const out = new Set<string>();
  const open = `${LEFT_CONTENT_CLAUSE} (`;
  for (const event of eventsByItem(db, itemId)) {
    if (!erases(event)) continue;
    const start = event.reason.indexOf(open);
    if (start < 0) continue;
    const end = event.reason.indexOf(")", start + open.length);
    if (end < 0) continue;
    const list = event.reason.slice(start + open.length, end);
    for (const h of list.split(", ")) if (h) out.add(h);
  }
  return out;
}

/** The event erases its item: the projection and replay drop it (ERASURE_ID). */
export function erases(event: MemoryEvent): boolean {
  return event.decision === "allow" && event.op === "retire" && event.policy_id === ERASURE_ID;
}

/**
 * The projection rule, as a pure function: the state of the event's item
 * after the event, given its state before (undefined when the item is
 * unknown). The stored projection and replay (itemsAt in replay.ts) both
 * apply exactly this, so they cannot drift apart. An erasure (`erases`) is
 * the one event that removes an item rather than changing it; both callers
 * check it first.
 */
export function applyEvent(
  before: MemoryItem | undefined,
  event: MemoryEvent,
): MemoryItem | undefined {
  if (event.decision !== "allow") return before;
  if (CHANGES_ITEM.has(event.op) && event.item) return event.item;
  if (RETIRES_ITEM.has(event.op) && before) return { ...before, status: "retired" };
  return before;
}

function storedItem(db: Db, id: string): MemoryItem | undefined {
  const row = db.prepare("SELECT body FROM items WHERE id = ?").get(id);
  return row ? (JSON.parse(String(row.body)) as MemoryItem) : undefined;
}

function project(db: Db, event: MemoryEvent): void {
  // checkConsistency guarantees an event carrying an item names it in item_id.
  if (!event.item_id) return;
  if (erases(event)) {
    db.prepare("DELETE FROM items WHERE id = ?").run(event.item_id);
    return;
  }
  const before = storedItem(db, event.item_id);
  const after = applyEvent(before, event);
  if (!after || after === before) return;
  db.prepare(
    `INSERT INTO items (id, status, body, store_adapter, store_key, seq) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET status = excluded.status, body = excluded.body,
       store_adapter = excluded.store_adapter, store_key = excluded.store_key, seq = excluded.seq`,
  ).run(
    after.id,
    after.status,
    JSON.stringify(after),
    after.store_ref?.adapter ?? null,
    after.store_ref?.key ?? null,
    event.seq,
  );
}

/**
 * Rules the JSON Schema cannot express: an allowed change to an item must
 * carry the item it produces, under the same id, or replay could not
 * reproduce it.
 */
function checkConsistency(input: EventInput): void {
  if (input.item && input.item.id !== input.item_id) {
    throw new Error(
      `event ${input.id}: item_id ${input.item_id} differs from item.id ${input.item.id}`,
    );
  }
  if (input.decision === "allow" && CHANGES_ITEM.has(input.op) && !input.item) {
    throw new Error(
      `event ${input.id}: an allowed ${input.op} carries no item, so replay cannot reproduce it`,
    );
  }
}

/** Validates the event, assigns the next dense seq, stores it and updates the projection. */
export function appendEvent(db: Db, input: EventInput): MemoryEvent {
  checkConsistency(input);
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

/** The event with id `id`, or null; one indexed lookup, not a scan of the log. */
export function eventById(db: Db, id: string): MemoryEvent | null {
  return parse(db.prepare("SELECT body FROM events WHERE id = ?").all(id))[0] ?? null;
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
