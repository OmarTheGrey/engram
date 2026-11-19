// Store-then-log commits across db handles (card E2.6, ADR 0007's amendment
// of 2026-11-19). The write queue (queue.ts) orders the calls of one handle;
// a writer on another handle over the same log (another process: `engram
// serve` beside an `engram read`) is ordered only by the log's lock, which a
// transaction holds (BEGIN IMMEDIATE on SQLite, the advisory lock on
// Postgres) and which no store call can hold, since adapters are
// asynchronous and a transaction's body is synchronous. So every operation
// that writes the store and then appends to the log follows one protocol:
//
// 1. Decide on the projection, noting the log's head (its last seq) at the
//    decision: the basis.
// 2. Write the store.
// 3. In one transaction, check the basis: no event that may change the item
//    (write, update, promote, retire, evict, of any decision) was appended
//    after the head, and no offboarding of its person scope began after it.
//    If so, append the allow. If not, the decision is stale: append nothing
//    yet, and settle.
// 4. Settle: put the store record back to what the log holds now (deleted
//    when the item is gone, erased or in a person scope an offboarding is
//    erasing; the projected item written back otherwise), then, in one more
//    transaction, check that nothing changed the item since the state it
//    wrote was read, and append the deny event there. If something did, put
//    it back again. The deny is appended after the store is put back, so a
//    writer whose decision came before it sees it as a change and settles in
//    turn; an adoption that listed the store before it sees it as a change and
//    leaves the record to its next listing.
//
// An offboarding marks its erasure first (offboard.ts): one event under
// engram/offboard/begin, appended in the transaction that reads what it will
// erase, before any store record is deleted. Until its report event
// (engram/offboard/report) closes it, every write, grant change, promotion
// and adoption into that person scope is refused at its decision
// (engram/offboard/erasing), and one decided before the mark finds it at step
// 3. Every store write is therefore followed by a check under the lock: a
// write that lands before the erasure deletes the record is deleted by it,
// and one that lands after is deleted by its own writer.
import type { StoreRef } from "../adapter.ts";
import type { Db } from "../db/db.ts";
import { erases, eventsByItem } from "../events.ts";
import { itemById } from "../items.ts";
import type { PlaneDeps } from "../plane.ts";
import { scopeLevel } from "../policy/evaluate.ts";
import type { MemoryEvent, MemoryItem } from "../schema.ts";

/** The rule of the event that marks an offboarding's erasure as begun (card E2.6). */
export const OFFBOARD_BEGIN_ID = "engram/offboard/begin";
/** The rule of the offboarding's summary event; it closes the erasure the begin event opened. */
export const OFFBOARD_REPORT_ID = "engram/offboard/report";
/** The rule of a refusal because the item's person scope is being erased. */
export const ERASING_ID = "engram/offboard/erasing";

/** How many times a stale decision's store record is put back before the plane gives up. */
const SETTLE_ROUNDS = 8;

/** The seq of the log's last event, or -1 for an empty log. */
export function logHead(db: Db): number {
  const row = db.prepare("SELECT coalesce(max(seq), -1) AS seq FROM events").get();
  return Number(row?.seq ?? -1);
}

/** Whether an event that may change `itemId`, of any decision, was appended after `head`. */
export function touchedSince(db: Db, itemId: string, head: number): boolean {
  return (
    db
      .prepare(
        `SELECT 1 AS hit FROM events WHERE item_id = ? AND seq > ?
         AND op IN ('write', 'update', 'promote', 'retire', 'evict') LIMIT 1`,
      )
      .get(itemId, head) !== undefined
  );
}

/** The seq of the last allowed offboarding event of `policyId` for `scope`, or -1. */
function lastMark(db: Db, scope: string, policyId: string): number {
  const rows = db
    .prepare(
      `SELECT seq, body FROM events WHERE scope_from = ? AND op = 'retire'
       AND item_id IS NULL AND decision = 'allow' ORDER BY seq DESC`,
    )
    .all(scope);
  for (const row of rows)
    if ((JSON.parse(String(row.body)) as MemoryEvent).policy_id === policyId)
      return Number(row.seq);
  return -1;
}

/** An offboarding began erasing `scope` and has not completed: its items may not change. */
export function erasureOpen(db: Db, scope: string): boolean {
  if (scopeLevel(scope) !== "person") return false;
  return lastMark(db, scope, OFFBOARD_BEGIN_ID) > lastMark(db, scope, OFFBOARD_REPORT_ID);
}

/** An offboarding of `scope` began after `head`. */
export function erasureBegunSince(db: Db, scope: string, head: number): boolean {
  return scopeLevel(scope) === "person" && lastMark(db, scope, OFFBOARD_BEGIN_ID) > head;
}

/** The refusal of a change to an item in a person scope an offboarding is erasing. */
export function erasingReason(scope: string): string {
  return `${scope} is being erased by an offboarding that has not completed; nothing in it may change until it does`;
}

/** The latest event that erased `itemId` (events.ts `erases`), or null. */
export function lastErasure(db: Db, itemId: string): MemoryEvent | null {
  return eventsByItem(db, itemId).filter(erases).at(-1) ?? null;
}

/** What a decision rested on: the log's head when it was taken, the items it read, the scopes it changes. */
export interface Basis {
  head: number;
  items: readonly string[];
  scopes: readonly string[];
}

/** The basis of a decision taken now on `items` into `scopes`. */
export function basisNow(db: Db, items: readonly string[], scopes: readonly string[]): Basis {
  return { head: logHead(db), items, scopes };
}

/**
 * Why a decision taken on `basis` no longer stands, or null when it does.
 * Call it inside the transaction that would append the decision's event.
 */
export function staleness(db: Db, basis: Basis): string | null {
  for (const itemId of basis.items) {
    if (!touchedSince(db, itemId, basis.head)) continue;
    const now = itemById(db, itemId);
    return now
      ? `item ${itemId} changed on another handle of this log (now version ${now.version}, ${now.status}) after the decision`
      : `item ${itemId} was erased or removed on another handle of this log after the decision`;
  }
  for (const scope of basis.scopes)
    if (erasureBegunSince(db, scope, basis.head))
      return `an offboarding began erasing ${scope} after the decision`;
  return null;
}

const sameRef = (a: StoreRef | null | undefined, b: StoreRef) =>
  a?.adapter === b.adapter && a.key === b.key;

/**
 * What the store should hold at `ref` for `itemId`, as the log has it now:
 * the projected item when it lives at that ref and its scope is not being
 * erased, otherwise nothing.
 */
function wanted(db: Db, itemId: string, ref: StoreRef): MemoryItem | null {
  const now = itemById(db, itemId);
  if (!now || !sameRef(now.store_ref, ref) || erasureOpen(db, now.scope)) return null;
  return now;
}

/**
 * Puts the store record `ref`, written for `itemId` on a decision that went
 * stale, back to what the log holds, then runs `confirm` in the transaction
 * that finds the item unchanged since that state was read (step 4 above):
 * `confirm` appends the deny event. Throws the store's error, or an Error
 * when the item kept changing for SETTLE_ROUNDS rounds; the caller records
 * either as a store failure.
 */
export async function settle<T>(
  deps: PlaneDeps,
  itemId: string,
  ref: StoreRef,
  confirm: () => T,
): Promise<T> {
  const { db, adapter } = deps;
  for (let round = 0; round < SETTLE_ROUNDS; round++) {
    const { head, desired } = db.transaction(() => ({
      head: logHead(db),
      desired: wanted(db, itemId, ref),
    }));
    if (desired) await adapter.write({ ...desired, store_ref: null } as MemoryItem);
    else await adapter.delete(ref);
    const settled = db.transaction(() => {
      if (touchedSince(db, itemId, head)) return null;
      if (desired && erasureBegunSince(db, desired.scope, head)) return null;
      return { value: confirm() };
    });
    if (settled) return settled.value;
  }
  throw new Error(
    `the store record of item ${itemId} could not be put back: the item kept changing on another handle for ${SETTLE_ROUNDS} rounds`,
  );
}
