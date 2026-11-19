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
import { createHash } from "node:crypto";
import type { Actor } from "../actor.ts";
import { mergingContentHash } from "../content-hash.ts";
import {
  appendEvent,
  currentItems,
  erasedStoreContent,
  eventsByItem,
  LEFT_CONTENT_CLAUSE,
} from "../events.ts";
import { itemById } from "../items.ts";
import type { PlaneDeps } from "../plane.ts";
import type { MemoryEvent, MemoryItem } from "../schema.ts";
import { erasureBegunSince, lastErasure, logHead, touchedSince } from "./commit.ts";
import { inWriteQueue } from "./queue.ts";
import { adoptWrite, withPlaneProvenance } from "./write.ts";

/** The policy_id of an adoption refused because the record holds content erased at offboarding. */
export const ADOPT_ERASED_ID = "engram/adopt/erased";

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

/** JSON with sorted keys, so equal items compare equal whatever their key order. */
const canonical = (v: unknown): string =>
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
const comparable = (item: MemoryItem, derived: readonly (keyof MemoryItem)[]) => {
  const out: Record<string, unknown> = { ...item, status: null };
  for (const field of derived) out[field] = null;
  return canonical(out);
};

/** The hash a deny event records: of the store's item as listed, compared as above. */
const itemHash = (item: MemoryItem, derived: readonly (keyof MemoryItem)[]) =>
  `sha256:${createHash("sha256").update(comparable(item, derived)).digest("hex")}`;

const hashNote = (hash: string) => `; store item ${hash}`;

export async function adoptStoreItems(
  deps: PlaneDeps,
  actor: Actor,
  scope: string,
  at: string,
): Promise<AdoptReport> {
  const { db, adapter, newId } = deps;
  const adopter: Actor = { ...actor, source: "import" };
  const prefix = `adopted from store ${adapter.name}: `;
  // The log's head before the store is listed: a change the log records
  // after it may postdate what the listing shows (card E2.6).
  const head = logHead(db);
  const listed = await adapter.list(scope);
  /** The listing is older than a change the log holds for this item or its scope: leave it to the next. */
  const stale = (itemId: string, itemScope: string, since = head) =>
    touchedSince(db, itemId, since) || erasureBegunSince(db, itemScope, since);
  const report: AdoptReport = {
    listed: listed.length,
    allowed: 0,
    denied: 0,
    unchanged: 0,
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
    if (lastWrite?.decision === "deny" && lastWrite.reason.endsWith(note)) {
      report.unchanged++;
      continue;
    }

    const adopted = await adoptWrite(deps, adopter, item, at, {
      ref: item.store_ref,
      prefix,
      suffix: note,
      listed: head,
      refuse: (candidate) => erasedRefusal(deps, candidate),
    });
    if (adopted === null) {
      report.unchanged++;
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
): { reason: string; policy_id: string } | null {
  const { db } = deps;
  if (erasedStoreContent(db, candidate.id).has(mergingContentHash(candidate.content)))
    return {
      reason: `the store's record of item ${candidate.id} holds content erased at an offboarding and left in the store; it is not adopted again until it changes`,
      policy_id: ADOPT_ERASED_ID,
    };
  if (itemById(db, candidate.id)) return null;
  const gone = lastErasure(db, candidate.id);
  if (!gone || gone.reason.includes(LEFT_CONTENT_CLAUSE)) return null;
  return {
    reason: `the store holds a record under the id of item ${candidate.id}, which an offboarding erased and deleted from the store; an erased id is never adopted again`,
    policy_id: ADOPT_ERASED_ID,
  };
}
