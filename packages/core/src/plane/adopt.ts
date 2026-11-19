// Adoption (needed by card E8.2; decision D8 of the review fix pass): bringing
// what a store already holds under the plane. The read path takes its
// candidates from the projection (card E2.2), so a memory written into a
// store before the plane governed it, such as a Claude Code memory file, is
// invisible until the log has a write for it.
//
// adoptStoreItems lists the adapter's items in one scope and runs each one,
// as it stands, through the same write gate as Plane.write, as the given
// actor with source `import` (the caller passes the store's owner, never
// whoever happens to read). An allowed item is recorded at the store_ref it
// already has and its bytes are never rewritten; a denied one leaves its deny
// event, whose reason records the hash of the store's item. Every event's
// reason starts `adopted from store <name>: `. Every decision is one event
// with its reason and policy_id (AGENTS.md rule 3).
//
// Skipped, with no event: an item the projection holds as the store has it
// (status aside, since the gate may land it as a candidate, and the fields
// the store derives from its own bookkeeping aside, Adapter.derivedFields, so
// touching a file is no new version), unless adoption itself retired it; and
// an item whose last write was denied with the same hash, so a denied item is
// not re-gated on every read.
//
// Refused, with one deny event (policy_id engram/adopt/erased) naming no
// content: the record an offboarding erased and left in a store that refuses
// the plane's delete, under that item's id, while it holds the erased content
// up to the merging form (case, width and invisible characters do not make it
// new; events.ts erasedStoreContent; ADR 0010, rechecks of PR #41). It is decided in the
// write queue, so an adoption queued behind an offboarding sees its erase
// events. Edited content, or another person's different file, adopts as any
// other record does.
//
// Across db handles (card E2.6, plane/commit.ts), each record's decision and
// its event are one transaction under the log's lock, in the write queue.
// The listing may be older than what the log holds: a record whose item the
// log changed after the listing began (any write, update, promote, retire or
// evict event, of any decision), or whose person scope an offboarding began
// erasing since, is left to the next adoption with no event, and so is the
// retraction of such an item. Into a person scope an offboarding is erasing
// nothing is adopted (engram/offboard/erasing), and a record under the id of
// an item an offboarding erased is refused (engram/adopt/erased) unless the
// erasure left that record in a store that refuses the plane's delete and
// it has changed since: anything else under that id is a store write that was
// in flight during the erasure, or a restored copy.
//
// Review fix pass of PR #50 (P50-2), as the verification of that pass left
// it (V-5, V-9, V-10). Such a record is also deleted from the store, once the
// deny event is committed, so a writer that threw or crashed between its
// store write and its commit, or whose repair failed, leaves no erased
// content behind for good. So is a record under an id an offboarding's sweep
// took out of the store (engram/offboard/swept). A record that appears in an
// offboarded person scope after its report, under an id the log never
// recorded, is the person's again and adopted as any other (V-5): the sweep
// at the end of the offboarding deleted what was left before the report. The
// deny says the plane deletes the record; when the delete fails, one
// store-failure deny says how, and later adoptions retry the delete quietly,
// recording only a different outcome: an error that changed, or the delete
// succeeding (V-9, V-10).
// A listed record left to the next adoption because the log changed it since
// the listing is counted under `deferred` (P50-7).
//
// Retracted, with one retire event (policy_id engram/adopt/retract): a
// projected item of this store and scope the store no longer lists, and a
// projected item whose store version the gate just denied. So the plane never
// serves content the store no longer has. When the store reports the entry
// as unreadable (Adapter.diagnostics, such as a file whose frontmatter no
// longer parses), the reason says so and names the store's diagnostic: the
// store cannot serve that entry, and what the plane holds is a version the
// store has since changed into something unreadable. An item retired by
// anything else (an owner, eviction) is not brought back while the store has
// it unchanged.
import type { Actor } from "../actor.ts";
import { isNotDeletable } from "../adapter.ts";
import { mergingContentHash } from "../content-hash.ts";
import {
  appendEvent,
  currentItems,
  erasedStoreContent,
  eventsByItem,
  LEFT_CONTENT_CLAUSE,
} from "../events.ts";
import { itemById, itemsByStoreRef } from "../items.ts";
import type { PlaneDeps } from "../plane.ts";
import { STORE_FAILURE_ID } from "../policy/evaluate.ts";
import type { MemoryEvent, MemoryItem } from "../schema.ts";
import {
  ADOPT_ERASED_ID,
  ADOPTION_PREFIX,
  comparable,
  erasureBegunSince,
  hashNote,
  itemHash,
  lastRemoval,
  logHead,
  touchedSince,
} from "./commit.ts";
import { inWriteQueue } from "./queue.ts";
import { adoptWrite, withPlaneProvenance } from "./write.ts";

export { ADOPT_ERASED_ID };

/** What the reason of a refusal whose record adoption deletes says (P50-2, V-10). */
export const PURGE_CLAUSE = "the plane deletes the record from the store";

/** The policy_id of a retire adoption appends when the store no longer has what the plane holds. */
export const ADOPT_RETRACT_ID = "engram/adopt/retract";

export interface AdoptReport {
  /** Items the adapter lists in the scope. */
  listed: number;
  allowed: number;
  denied: number;
  /**
   * Listed items with no new event: held by the projection as the store has
   * them, or denied before with the same hash.
   */
  unchanged: number;
  /**
   * Listed items left to the next adoption, with no event, because the log
   * changed them, or began erasing their scope, after the store was listed.
   */
  deferred: number;
  /** Projected items retired because the store no longer has them as the plane held them. */
  retired: number;
  denials: { item_id: string; reason: string; policy_id: string }[];
  retirements: { item_id: string; reason: string }[];
  /**
   * The events the budget checks of adopted writes appended (ADR 0025):
   * evictions, or a manual rule's ask (review finding P4-10).
   */
  evictions: MemoryEvent[];
}

export async function adoptStoreItems(
  deps: PlaneDeps,
  actor: Actor,
  scope: string,
  at: string,
): Promise<AdoptReport> {
  const { db, adapter, newId } = deps;
  const adopter: Actor = { ...actor, source: "import" };
  const prefix = `${ADOPTION_PREFIX}${adapter.name}: `;
  // The log's head before the store is listed: a change the log records
  // after it may postdate what the listing shows (card E2.6).
  const head = logHead(db);
  const listed = await adapter.list(scope);
  /** The listing is older than a change the log holds for this item or its scope: leave it to the next. */
  const stale = (itemId: string, itemScope: string, since = head) =>
    touchedSince(db, itemId, since) || erasureBegunSince(db, itemScope, since);
  /**
   * Deletes the record whose purge `policy` decided, and records what
   * happened unless it repeats `previous`, the last event about these bytes:
   * a failure as one store-failure deny naming how (V-10), a success after a
   * failure as one more event saying so. A first success adds nothing: the
   * refusal already said the plane deletes the record.
   */
  const purgeOutcome = async (
    item: MemoryItem,
    policy: string,
    note: string,
    previous: MemoryEvent | null | undefined,
  ) => {
    let outcome: { reason: string; policy_id: string } | null = null;
    try {
      await adapter.delete(item.store_ref as NonNullable<MemoryItem["store_ref"]>);
      if (previous?.policy_id === STORE_FAILURE_ID)
        outcome = {
          reason: `${prefix}the record refused under ${policy} was deleted from the store on a later try${note}`,
          policy_id: policy,
        };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      outcome = {
        reason: isNotDeletable(e)
          ? `${prefix}the record refused under ${policy} stays in the store, which refuses the delete for good (${err}); it stays refused${note}`
          : `${prefix}the record refused under ${policy} could not be deleted from the store (${err}); later adoptions try again${note}`,
        policy_id: STORE_FAILURE_ID,
      };
    }
    if (!outcome || outcome.reason === previous?.reason) return;
    const recorded = outcome;
    await inWriteQueue(db, () =>
      appendEvent(db, {
        id: newId(),
        ts: at,
        op: "write",
        item_id: item.id,
        actor: adopter.id,
        scope_from: null,
        scope_to: item.scope,
        decision: "deny",
        reason: recorded.reason,
        policy_id: recorded.policy_id,
        schema_version: 1,
      }),
    );
  };
  const report: AdoptReport = {
    listed: listed.length,
    allowed: 0,
    denied: 0,
    unchanged: 0,
    deferred: 0,
    retired: 0,
    denials: [],
    retirements: [],
    evictions: [],
  };
  /** Appends one retraction; called only from inside a write queue task. */
  const retire = (item: MemoryItem, why: string) => {
    const reason = `${prefix}${why}`;
    appendEvent(db, {
      id: newId(),
      ts: at,
      op: "retire",
      item_id: item.id,
      actor: adopter.id,
      scope_from: null,
      scope_to: item.scope,
      decision: "allow",
      reason,
      policy_id: ADOPT_RETRACT_ID,
      schema_version: 1,
    });
    report.retired++;
    report.retirements.push({ item_id: item.id, reason });
  };

  for (const item of listed) {
    if (!item.store_ref) {
      throw new Error(`adopt: ${adapter.name} listed item ${item.id} without a store_ref`);
    }
    const known = itemById(db, item.id);
    const history = eventsByItem(db, item.id);
    const [asAdopted] = withPlaneProvenance(adopter, item);
    const derived = adapter.derivedFields?.(item) ?? [];
    if (known && comparable(known, derived) === comparable(asAdopted, derived)) {
      const retracted = history.at(-1)?.policy_id === ADOPT_RETRACT_ID;
      if (known.status !== "retired" || !retracted) {
        report.unchanged++;
        continue;
      }
    }
    const note = hashNote(itemHash(item, derived));
    const lastWrite = history.filter((e) => e.op === "write").at(-1);
    const purgeable = erasedRefusal(deps, item)?.purge === true;
    // The purge of these bytes was decided already: retry the delete, and
    // record only a new outcome (V-9).
    const decided =
      purgeable &&
      lastWrite?.decision === "deny" &&
      lastWrite.reason.endsWith(note) &&
      (lastWrite.policy_id === ADOPT_ERASED_ID || lastWrite.policy_id === STORE_FAILURE_ID) &&
      history.some(
        (e) =>
          e.policy_id === ADOPT_ERASED_ID &&
          e.reason.endsWith(note) &&
          e.reason.includes(PURGE_CLAUSE),
      );
    if (decided) {
      await purgeOutcome(item, ADOPT_ERASED_ID, note, lastWrite);
      report.unchanged++;
      continue;
    }
    // A record to delete is gated again even when an earlier refusal of the
    // same bytes stands (an erasing refusal, say).
    if (lastWrite?.decision === "deny" && lastWrite.reason.endsWith(note) && !purgeable) {
      report.unchanged++;
      continue;
    }

    let purge = false;
    const adopted = await adoptWrite(deps, adopter, item, at, {
      ref: item.store_ref,
      prefix,
      suffix: note,
      listed: head,
      refuse: (candidate) => {
        const refusal = erasedRefusal(deps, candidate);
        purge = refusal?.purge === true;
        return refusal;
      },
    });
    if (adopted === null) {
      report.deferred++;
      continue;
    }
    const { event, retention } = adopted;
    report.evictions.push(...retention);
    if (event.decision === "allow") {
      report.allowed++;
      continue;
    }
    report.denied++;
    report.denials.push({ item_id: item.id, reason: event.reason, policy_id: event.policy_id });
    if (purge) {
      // The refusal is committed; now the record goes.
      await purgeOutcome(item, event.policy_id, note, null);
      continue;
    }
    // In the write queue, like every change to items; the projection is
    // read again there, so a write that landed meanwhile is respected.
    await inWriteQueue(db, () =>
      db.transaction(() => {
        const held = itemById(db, item.id);
        // Changed since this adoption's own deny, by another handle: leave it.
        if (held && held.status !== "retired" && !stale(held.id, held.scope, event.seq))
          retire(
            held,
            `the store's version of item ${held.id} was denied (${event.policy_id}); the plane retires the version it held, which the store no longer has`,
          );
      }),
    );
  }

  const present = new Set(listed.map((i) => i.id));
  const unreadable = new Map((adapter.diagnostics?.() ?? []).map((d) => [d.key, d.reason]));
  await inWriteQueue(db, () =>
    db.transaction(() => {
      for (const held of currentItems(db)) {
        if (held.scope !== scope || held.status === "retired" || present.has(held.id)) continue;
        if (held.store_ref?.adapter !== adapter.name) continue;
        // Written or changed since the listing, which may predate it.
        if (stale(held.id, held.scope)) continue;
        const diagnostic = unreadable.get(held.store_ref.key);
        retire(
          held,
          diagnostic === undefined
            ? `item ${held.id} is no longer in store ${adapter.name} scope ${scope}; the plane retires its projected version`
            : `store ${adapter.name} can no longer read item ${held.id} (${held.store_ref.key}): ${diagnostic}; the plane retires its projected version, which the store no longer holds in a readable form`,
        );
      }
    }),
  );
  return report;
}

/**
 * Why adoption refuses the store's record of `candidate`, or null: it holds
 * an erased item's id and the projection does not hold that id. When the
 * erasure left the record in a store that refuses the plane's delete, the
 * record is refused while it holds the erased content (the merging hashes the
 * erase event names; rechecks of PR #41), and adopted once it changes. When
 * the erasure deleted the record, or there was none, a record under that id
 * can only be a store write that was in flight when the person was erased,
 * or a restored copy, so it is refused whatever it holds (card E2.6): an
 * erased id is never adopted again. Neither reason names content.
 */
function erasedRefusal(
  deps: PlaneDeps,
  candidate: MemoryItem,
): { reason: string; policy_id: string; purge?: boolean } | null {
  const { db } = deps;
  if (erasedStoreContent(db, candidate.id).has(mergingContentHash(candidate.content)))
    return {
      reason: `the store's record of item ${candidate.id} holds content erased at an offboarding and left in the store; it is not adopted again until it changes`,
      policy_id: ADOPT_ERASED_ID,
    };
  if (itemById(db, candidate.id)) return null;
  const gone = lastRemoval(db, candidate.id);
  if (!gone || gone.reason.includes(LEFT_CONTENT_CLAUSE)) return null;
  // A record whose ref a projected item holds (a version shared out of the
  // person scope, review of PR #33) is refused, never deleted: deleting it
  // would delete that item's bytes.
  if (candidate.store_ref && itemsByStoreRef(db, candidate.store_ref).length > 0)
    return {
      reason: `the store holds a record under the id of item ${candidate.id}, which an offboarding took out of its person scope (${gone.policy_id}); an item outside that scope holds the same record, so it is refused and kept`,
      policy_id: ADOPT_ERASED_ID,
    };
  return {
    reason: `the store holds a record under the id of item ${candidate.id}, which an offboarding took out of the store (${gone.policy_id}); that id is never adopted again, and ${PURGE_CLAUSE}`,
    policy_id: ADOPT_ERASED_ID,
    purge: true,
  };
}
