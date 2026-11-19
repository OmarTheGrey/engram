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
//
// Review fix pass of PR #50. What counts as a change to an item (step 3) is
// an allowed event, or a deny the plane appends because a store write may
// have happened without its decision standing (a conflict, a store failure,
// an adoption's purge of a record); a gate's deny changes nothing and does
// not count (P50-4). Each begin mark is closed by its own report only
// (P50-5). And settling withdraws an adoption that recorded this writer's own
// stale bytes: when the log's only changes to the item since the decision are
// adoptions that started with one of those bytes, the item is put back as it
// stood before them, by one allowed event (engram/adopt/withdrawn), so a
// stale write never comes back as the owner's import (P50-1, ordering RV8).
import { createHash } from "node:crypto";
import type { StoreRef } from "../adapter.ts";
import type { Db } from "../db/db.ts";
import { appendEvent, applyEvent, erases, eventsByItem } from "../events.ts";
import { itemById } from "../items.ts";
import type { PlaneDeps } from "../plane.ts";
import { STORE_FAILURE_ID, scopeLevel } from "../policy/evaluate.ts";
import { GRANT_CONFLICT_ID } from "../policy/grants.ts";
import type { MemoryEvent, MemoryItem } from "../schema.ts";

/** The rule of the event that marks an offboarding's erasure as begun (card E2.6). */
export const OFFBOARD_BEGIN_ID = "engram/offboard/begin";
/** The rule of the offboarding's summary event; it closes the erasure the begin event opened. */
export const OFFBOARD_REPORT_ID = "engram/offboard/report";
/** The rule of a refusal because the item's person scope is being erased. */
export const ERASING_ID = "engram/offboard/erasing";
/** The rule of a write refused because its decision went stale before its commit (card E2.6). */
export const WRITE_CONFLICT_ID = "engram/write/conflict";
/** The rule of a promotion refused because its decision went stale before its commit (card E2.6). */
export const PROMOTE_CONFLICT_ID = "engram/promote/conflict";
/** The rule of a handover refused because its item changed on another handle meanwhile (card E2.6). */
export const HANDOVER_CONFLICT_ID = "engram/offboard/conflict";
/** The rule of an adoption refused, and its record deleted, because it holds an erased id (ADR 0010). */
export const ADOPT_ERASED_ID = "engram/adopt/erased";
/**
 * The rule of an adoption refused, and its record deleted, because the record
 * lies in an offboarded person scope under an id the log never allowed: a
 * write that never committed (review of PR #50, P50-2).
 */
export const ADOPT_OFFBOARDED_ID = "engram/adopt/offboarded";
/** The rule of an adoption a stale writer withdraws: it recorded that writer's own bytes (P50-1). */
export const ADOPT_WITHDRAWN_ID = "engram/adopt/withdrawn";
/** How every adoption event's reason begins (plane/adopt.ts). */
export const ADOPTION_PREFIX = "adopted from store ";

/**
 * The denies that count as a change to their item: each follows a store
 * write, or a store record's removal, whose decision did not stand.
 */
const COUNTED_DENIES = new Set([
  WRITE_CONFLICT_ID,
  GRANT_CONFLICT_ID,
  PROMOTE_CONFLICT_ID,
  HANDOVER_CONFLICT_ID,
  STORE_FAILURE_ID,
  ADOPT_ERASED_ID,
  ADOPT_OFFBOARDED_ID,
]);

/** JSON with sorted keys, so equal items compare equal whatever their key order. */
export const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  );

/**
 * What adoption compares: the item without its status (the gate may land it
 * as a candidate) and without the fields the store derived rather than
 * stored (Adapter.derivedFields), so touching a file is no new version.
 */
export const comparable = (item: MemoryItem, derived: readonly (keyof MemoryItem)[]) => {
  const out: Record<string, unknown> = { ...item, status: null };
  for (const field of derived) out[field] = null;
  return canonical(out);
};

/** The hash an adoption's events record: of the store's item as listed, compared as above. */
export const itemHash = (item: MemoryItem, derived: readonly (keyof MemoryItem)[]) =>
  `sha256:${createHash("sha256").update(comparable(item, derived)).digest("hex")}`;

/** The suffix of every adoption event's reason, naming the store item's hash. */
export const hashNote = (hash: string) => `; store item ${hash}`;

/** How many times a stale decision's store record is put back before the plane gives up. */
const SETTLE_ROUNDS = 8;

/** The seq of the log's last event, or -1 for an empty log. */
export function logHead(db: Db): number {
  const row = db.prepare("SELECT coalesce(max(seq), -1) AS seq FROM events").get();
  return Number(row?.seq ?? -1);
}

/**
 * Whether a change to `itemId` was appended after `head`: an allowed write,
 * update, promote, retire or evict event, or one of the plane's own denies
 * that follow a store write whose decision did not stand (COUNTED_DENIES).
 * A gate's deny changes nothing and does not count (P50-4).
 */
export function touchedSince(
  db: Db,
  itemId: string,
  head: number,
  ignore?: (event: MemoryEvent) => boolean,
): boolean {
  const rows = db
    .prepare(
      `SELECT body FROM events WHERE item_id = ? AND seq > ?
       AND op IN ('write', 'update', 'promote', 'retire', 'evict')`,
    )
    .all(itemId, head);
  return rows.some((r) => {
    const e = JSON.parse(String(r.body)) as MemoryEvent;
    if (ignore?.(e)) return false;
    return e.decision === "allow" || COUNTED_DENIES.has(e.policy_id);
  });
}

/** The clause a report's reason ends with, naming the begin mark it closes (P50-5). */
export const closesClause = (beginId: string) => `closes the erasure begun at event ${beginId}`;

/** The allowed offboarding marks of `scope`, in log order. */
function marks(db: Db, scope: string): MemoryEvent[] {
  return db
    .prepare(
      `SELECT body FROM events WHERE scope_from = ? AND op = 'retire'
       AND item_id IS NULL AND decision = 'allow' ORDER BY seq`,
    )
    .all(scope)
    .map((r) => JSON.parse(String(r.body)) as MemoryEvent)
    .filter((e) => e.policy_id === OFFBOARD_BEGIN_ID || e.policy_id === OFFBOARD_REPORT_ID);
}

/**
 * An offboarding began erasing `scope` and has not completed: its items may
 * not change. Each begin mark is closed by the report naming it
 * (closesClause); a report written before that clause existed closes every
 * mark before it.
 */
export function erasureOpen(db: Db, scope: string): boolean {
  if (scopeLevel(scope) !== "person") return false;
  const open = new Set<string>();
  for (const e of marks(db, scope)) {
    if (e.policy_id === OFFBOARD_BEGIN_ID) open.add(e.id);
    else if (!e.reason.includes(closesClause(""))) open.clear();
    else for (const id of [...open]) if (e.reason.includes(closesClause(id))) open.delete(id);
  }
  return open.size > 0;
}

/** An offboarding of `scope` began after `head`. */
export function erasureBegunSince(db: Db, scope: string, head: number): boolean {
  return (
    scopeLevel(scope) === "person" &&
    marks(db, scope).some((e) => e.policy_id === OFFBOARD_BEGIN_ID && e.seq > head)
  );
}

/** Whether `scope` was offboarded at least once and no offboarding of it is open. */
export function offboarded(db: Db, scope: string): boolean {
  return (
    scopeLevel(scope) === "person" &&
    marks(db, scope).some((e) => e.policy_id === OFFBOARD_REPORT_ID) &&
    !erasureOpen(db, scope)
  );
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
export function staleness(
  db: Db,
  basis: Basis,
  ignore?: (event: MemoryEvent) => boolean,
): string | null {
  for (const itemId of basis.items) {
    if (!touchedSince(db, itemId, basis.head, ignore)) continue;
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

/** What a stale writer put in the store: the item as written, at the ref the store gave. */
export interface StaleWrite {
  /** The item as the writer stored it, with the ref the store returned. */
  wrote: MemoryItem;
  /** The log's head at the writer's decision. */
  head: number;
  /** The writer's actor id and time, for the withdrawal event. */
  actor: string;
  at: string;
}

const sameAsWritten = (deps: PlaneDeps, event: MemoryEvent, wrote: MemoryItem) => {
  const derived = deps.adapter.derivedFields?.(wrote) ?? [];
  if (event.decision === "allow" && event.item) {
    const strip = (i: MemoryItem) =>
      comparable(
        { ...i, provenance: { ...i.provenance, kind: "import", actor: "" } } as MemoryItem,
        derived,
      );
    return strip(event.item) === strip(wrote);
  }
  return event.reason.endsWith(hashNote(itemHash(wrote, derived)));
};

/**
 * An adoption that recorded exactly the bytes `wrote` holds, while its writer
 * had not yet committed: the writer's own write seen early, not a change to
 * it, so the writer's check ignores it and its allow replaces the adoption's
 * import provenance with its own.
 */
export const ownBytes =
  (deps: PlaneDeps, wrote: MemoryItem) =>
  (e: MemoryEvent): boolean =>
    e.op === "write" &&
    e.decision === "allow" &&
    e.reason.startsWith(ADOPTION_PREFIX) &&
    sameAsWritten(deps, e, wrote);

/**
 * The adoption a stale writer withdraws, or null (P50-1): the first adoption
 * event about `itemId` after the writer's decision that concerned the very
 * bytes it wrote (an allow recording them, or a deny of them), when every
 * allowed change to the item since is an adoption's. The item is restored as
 * it stood before that event; undefined when it did not exist then.
 */
function ownAdoption(
  deps: PlaneDeps,
  itemId: string,
  stale: StaleWrite,
): { event: MemoryEvent; before: MemoryItem | undefined } | null {
  const history = eventsByItem(deps.db, itemId);
  const own = history.find(
    (e) =>
      e.seq > stale.head &&
      e.op === "write" &&
      e.reason.startsWith(ADOPTION_PREFIX) &&
      sameAsWritten(deps, e, stale.wrote),
  );
  if (!own) return null;
  const later = history.filter((e) => e.seq >= own.seq && e.decision === "allow");
  if (!later.every((e) => e.reason.startsWith(ADOPTION_PREFIX))) return null;
  let before: MemoryItem | undefined;
  for (const e of history) {
    if (e.seq >= own.seq) break;
    before = erases(e) ? undefined : applyEvent(before, e);
  }
  return { event: own, before };
}

/**
 * Puts the store record `ref`, written for `itemId` on a decision that went
 * stale, back to what the log holds, then runs `confirm` in the transaction
 * that finds the item unchanged since that state was read (step 4 above):
 * `confirm` appends the deny event. When an adoption recorded the stale
 * bytes, or retired the item over them (ownAdoption), the log is put back
 * too, by one withdrawal event before the deny. Throws the store's error, or
 * an Error when the item kept changing for SETTLE_ROUNDS rounds; the caller
 * records either as a store failure.
 */
export async function settle<T>(
  deps: PlaneDeps,
  itemId: string,
  ref: StoreRef,
  stale: StaleWrite,
  confirm: () => T,
): Promise<T> {
  const { db, adapter, newId } = deps;
  for (let round = 0; round < SETTLE_ROUNDS; round++) {
    const { head, desired, withdraw } = db.transaction(() => {
      const head = logHead(db);
      const desired = wanted(db, itemId, ref);
      const own = desired ? ownAdoption(deps, itemId, stale) : null;
      if (!own) return { head, desired, withdraw: null };
      const restored = own.before
        ? ({
            ...own.before,
            version: Math.max(own.before.version, desired?.version ?? 0),
          } as MemoryItem)
        : null;
      return { head, desired: restored, withdraw: { own, restored } };
    });
    let written: StoreRef | null = null;
    if (desired) written = await adapter.write({ ...desired, store_ref: null } as MemoryItem);
    else await adapter.delete(ref);
    const settled = db.transaction(() => {
      if (touchedSince(db, itemId, head)) return null;
      if (desired && erasureBegunSince(db, desired.scope, head)) return null;
      if (withdraw) {
        const now = itemById(db, itemId) as MemoryItem;
        const why = `the adoption at event ${withdraw.own.event.id} recorded bytes a stale write of item ${itemId} had put in the store before that write was refused`;
        appendEvent(db, {
          id: newId(),
          ts: stale.at,
          op: withdraw.restored ? "update" : "retire",
          item_id: itemId,
          actor: stale.actor,
          scope_from: now.scope,
          scope_to: now.scope,
          decision: "allow",
          reason: withdraw.restored
            ? `${why}; the adoption is withdrawn and the item restored as it stood before it, at version ${withdraw.restored.version}`
            : `${why}; the item did not exist before it, so the adopted item is retired`,
          policy_id: ADOPT_WITHDRAWN_ID,
          ...(withdraw.restored
            ? { item: { ...withdraw.restored, store_ref: written ?? withdraw.restored.store_ref } }
            : {}),
          schema_version: 1,
        });
      }
      return { value: confirm() };
    });
    if (settled) return settled.value;
  }
  throw new Error(
    `the store record of item ${itemId} could not be put back: the item kept changing on another handle for ${SETTLE_ROUNDS} rounds`,
  );
}
