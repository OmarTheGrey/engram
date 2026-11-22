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
 * The clause an erase event's reason carries for an item whose store record
 * the erasure found nowhere at its ref (review fix pass of PR #58, I-1): a
 * store that moved (a files folder renamed while the plane still names the
 * old root) or a record deleted outside the plane. Its deletion is not
 * proven, so the event also carries LEFT_CONTENT_CLAUSE with the erased
 * versions' hashes, and adoption refuses that content in the person scope
 * under any id. As for a record left in a store that refuses the delete, a
 * record under the erased id itself is refused while it holds that content
 * and adopted once it changes (keptInStore; review fix pass 2, N-3).
 */
export const NOT_FOUND_CLAUSE = "no record was found at its ref, so its deletion is not proven";

/** The rule of an offboarding's sweep of a left record (plane/commit.ts OFFBOARD_SWEPT_ID). */
const SWEPT_ID = "engram/offboard/swept";

/** The merging content hashes an erase or sweep event's LEFT_CONTENT_CLAUSE names, if any. */
function leftHashes(event: MemoryEvent): string[] {
  // An erasure, or an offboarding's sweep of a record the store would not
  // let it delete (engram/offboard/swept; verification pass 3 of PR #50).
  if (!erases(event) && event.policy_id !== SWEPT_ID) return [];
  const open = `${LEFT_CONTENT_CLAUSE} (`;
  // The clause ends the reason; the store's error text comes before it.
  const start = event.reason.lastIndexOf(open);
  if (start < 0) return [];
  const end = event.reason.indexOf(")", start + open.length);
  if (end < 0) return [];
  return event.reason
    .slice(start + open.length, end)
    .split(", ")
    .filter((h) => h !== "");
}

/**
 * Whether the erase or sweep event `event` says its item's record may still
 * be in a store: left in one that refuses the plane's delete, or found
 * nowhere at its ref (NOT_FOUND_CLAUSE). Either way it names the erased
 * content, and a record under that id is refused only while it holds that
 * content; changed, it is the person's to adopt (rechecks of PR #41; review
 * fix pass 2 of PR #58, N-3: a folder moved back after the erasure, a new
 * file written under an erased id, adopts as after an ordinary erasure).
 */
export function keptInStore(event: MemoryEvent): boolean {
  return event.reason.includes(LEFT_CONTENT_CLAUSE);
}

/**
 * The erased content hashes the erase events of one item name
 * (LEFT_CONTENT_CLAUSE): the record left in the store under that id, and only
 * it, is refused while it holds them. One indexed lookup by item id.
 */
export function erasedStoreContent(db: Db, itemId: string): Set<string> {
  const out = new Set<string>();
  for (const event of eventsByItem(db, itemId)) for (const h of leftHashes(event)) out.add(h);
  return out;
}

/**
 * The merging content hashes erasedStoreContent names for every item an
 * offboarding of `scope` erased or swept and left in a store, or found
 * nowhere at its ref (card RV4): what adoption refuses in that scope under
 * any id, since a store may give a record it kept a new id (a moved files
 * folder re-keys its files). Only erase and sweep events count. Returns a
 * reader for one adoption: each call reads only the scope's retire events
 * appended since the last call, so an adoption gating many records reads
 * each erasure once (review fix pass of PR #58, I-7), and still sees one
 * committed while it runs.
 */
export function erasedScopeContent(db: Db, scope: string): () => ReadonlySet<string> {
  const out = new Set<string>();
  let after = 0;
  return () => {
    const rows = db
      .prepare(
        "SELECT seq, body FROM events WHERE scope_from = ? AND op = 'retire' AND seq > ? ORDER BY seq",
      )
      .all(scope, after);
    for (const row of rows) {
      after = Number(row.seq);
      for (const h of leftHashes(JSON.parse(String(row.body)) as MemoryEvent)) out.add(h);
    }
    return out;
  };
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

/**
 * The events after `seq`, in order: what a decision export (card E8.13)
 * has not sent yet. `lastSeq` is where it starts: the log's head, or -1.
 */
export function eventsAfter(db: Db, seq: number): MemoryEvent[] {
  return parse(db.prepare("SELECT body FROM events WHERE seq > ? ORDER BY seq").all(seq));
}

/** The seq of the log's last event, or -1 for an empty log. */
export function lastSeq(db: Db): number {
  const row = db.prepare("SELECT coalesce(max(seq), -1) AS seq FROM events").get();
  return Number(row?.seq ?? -1);
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
