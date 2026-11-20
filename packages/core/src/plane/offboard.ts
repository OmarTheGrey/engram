// Offboarding (card E9.7, ADR 0021 and ADR 0010): when a person leaves, each
// role scope they hold is handed to a successor and their person scope is
// erased, with a deletion report. It runs in one slot of the write queue.
//
// Handover. Every item in a handed-over role scope that the leaver owns, of
// any status, becomes the successor's: a new version in place (same id,
// version plus one, owner the successor), rewritten to the store and recorded
// by one `update` event (`engram/offboard/handover`). Who reads the role is
// unchanged: membership of a scope is the harness's, so the successor reads
// the role once their harness makes them a member (ADR 0006's amendments);
// what changes is who may rewrite its items (a rewrite keeps the owner, D4).
//
// Erasure, the one hard deletion the plane makes (ADR 0010). Every item in the
// person scope, every version and status, is deleted from the store, its
// projection and explanation rows are removed, the content, provenance ref
// and evidence hash it carries in every earlier event are redacted, and one
// `retire` event per item (`engram/offboard/erase`, events.ts) makes replay
// drop it too, so a log rebuilt or replayed never brings it back. The log is
// append-only apart from this redaction, which exists so erasure is real; the
// events themselves, their ids, decisions and reasons stay, so the audit
// trail of what was decided is kept without what was remembered. A store ref
// that an item outside the person scope also holds is not deleted, and the
// report says so (review of PR #33). A lint event (card L1) carries its item
// by id only and its evidence in `reason`, so the reason of every lint event
// about an erased item, or whose evidence names one or its content hash, is
// redacted too, keeping its lint id, severity and rule (post-merge review of
// 2026-11-13). Each erase event says what happened to its item in the store:
// deleted, kept because an item outside the person scope holds the same
// ref, or there was no store record.
//
// A store failure while handing a role over is denied with one event
// (`engram/write/store-failure`) and thrown before anything is erased;
// offboarding again completes it, since what moved is no longer the leaver's.
// A transient store failure while deleting an item's ref leaves that item
// unerased: it stays in the projection, unredacted, with one deny event under
// the same rule naming it, and the report lists it under store_failures;
// offboarding again once the store recovers erases it. The others are erased.
// A permanent refusal (NotDeletableError, adapter.ts: a record the store
// never lets the plane delete, such as a memory file Engram did not write)
// does not hold the item back, since no rerun would succeed: the item is
// erased from the projection and the log, the report lists its ref under
// left_in_store for the person to delete in the store, and its erase event
// names the strict content hashes of every erased version and of the record
// the store still holds, so adoption refuses that record while it holds the
// erased content (a deny event, engram/adopt/erased) and adopts anything else
// normally. Those hashes are the one trace of erased content the log keeps,
// and only for records still in a store, or that may be (ADR 0010, recheck
// of PR #41). A ref the store holds no record at (its read finds none before
// the delete) is not proven deleted (review fix pass of PR #58, I-1): a files
// folder renamed while the plane names its old root still holds every record
// elsewhere. The item is erased all the same; the report lists the ref under
// not_found_in_store, and its erase event carries NOT_FOUND_CLAUSE beside
// LEFT_CONTENT_CLAUSE with the erased versions' hashes, so adoption refuses
// that content in the person scope under any id, and refuses the erased id
// itself whatever it holds (deleting that record, as the erasure meant to).
//
// The deletion report names what was erased and handed over, by id, and what
// this call cannot reach. It carries no content. One summary event
// (`engram/offboard/report`) records the offboarding in the log.
//
// Across db handles (card E2.6, plane/commit.ts). The erasure is marked
// before any store record is deleted: one event (engram/offboard/begin),
// appended in the transaction that reads what will be erased and handed
// over, opens it, and the report event closes it. While it is open, every
// write, grant change, promotion and adoption into the person scope is
// refused (engram/offboard/erasing), and one decided before the mark finds
// the mark under the log's lock and deletes what it wrote. So a store write
// for an erased item either lands before the erasure deletes the record, and
// is deleted with it, or lands after, and is deleted by its own writer. If
// offboarding stops between the mark and the report (a crash, a store failure
// during handover), the person scope stays frozen until offboarding runs
// again and completes. Each handover is checked under the lock like any
// store-then-log commit: if the item changed on another handle since it was
// read, the handover of that version is refused (engram/offboard/conflict),
// the store is put back as the log has it, and the item is handed over again
// as it now stands, so an owner's change made meanwhile, such as a grant
// removal, is kept. After the last attempt an item still the leaver's is left
// with one deny event (engram/offboard/not-handed-over), listed in the
// report's not_reached and counted in its reason (review of PR #50, P50-3).
// The report's reason names this offboarding's begin mark, and closes it and
// every mark that was open when it was appended (verification of PR #50,
// V-1): a rerun after an offboarding that stopped after its mark reopens the
// scope, and an offboarding begun later stays open until its own report.
// Before the report, the sweep deletes what the stores still hold that the
// erasure must not leave (engram/offboard/swept; see the sweep below). A
// record that appears in the person scope after the report, under an id the
// log never recorded and with no lineage to erased content, is adopted as
// the person's: the plane cannot tell it from a new memory written then, and
// whether a completed offboarding should refuse such records is an open
// question for the lead (ADR 0010).
//
// Who may offboard: a user-sourced actor who is a member of the person scope
// and of every role scope handed over, else one deny event
// (`engram/offboard/membership`) and nothing changes. Memberships are the
// harness's and, without authentication, self-asserted (ADR 0027): through
// the CLI this is only as strong as the machine it runs on.
import { type Actor, checkCall, InvalidCallError } from "../actor.ts";
import { isNotDeletable, type StoreRef } from "../adapter.ts";
import { mergingContentHash, strictContentHash } from "../content-hash.ts";
import {
  appendEvent,
  currentItems,
  ERASURE_ID,
  erases,
  eventsByItem,
  keptInStore,
  LEFT_CONTENT_CLAUSE,
  NOT_FOUND_CLAUSE,
} from "../events.ts";
import { itemById, itemsByStoreRef } from "../items.ts";
import { refItemId } from "../lint/det.ts";
import type { PlaneDeps } from "../plane.ts";
import { STORE_FAILURE_ID, scopeLevel } from "../policy/evaluate.ts";
import { type MemoryEvent, type MemoryItem, Principal, SCHEMA_VERSION, Scope } from "../schema.ts";
import {
  type Basis,
  closesClause,
  HANDOVER_CONFLICT_ID,
  logHead,
  OFFBOARD_BEGIN_ID,
  OFFBOARD_REPORT_ID,
  OFFBOARD_SWEPT_ID,
  ownBytes,
  removedAncestor,
  settle,
  staleness,
  touchedSince,
} from "./commit.ts";
import { inWriteQueue } from "./queue.ts";

export const HANDOVER_ID = "engram/offboard/handover";
/** The rule of the deny left for an item whose handover conflicted on every attempt (P50-3). */
export const NOT_HANDED_OVER_ID = "engram/offboard/not-handed-over";
export const OFFBOARD_MEMBERSHIP_ID = "engram/offboard/membership";
export {
  ERASURE_ID,
  HANDOVER_CONFLICT_ID,
  OFFBOARD_BEGIN_ID,
  OFFBOARD_REPORT_ID,
  OFFBOARD_SWEPT_ID,
};

/** How many times one item's handover is decided again after a conflict before it is left. */
const HANDOVER_ATTEMPTS = 4;

/** What an erased item's content and evidence become in the log. */
export const REDACTED = "[erased]";
const REDACTED_HASH = `sha256:${"0".repeat(64)}`;

export interface OffboardRequest {
  /** The person scope to erase, `person:<id>`; its id is the leaver's principal. */
  person: string;
  /** Each role scope the leaver holds and who takes it over. */
  roles: { scope: string; successor: string }[];
}

export interface DeletionReport {
  /** `deny` when the actor may not offboard; nothing changed. */
  decision: "allow" | "deny";
  reason: string;
  person: string;
  handover: { scope: string; successor: string; items: string[] }[];
  erased: {
    /** Every erased item id, every version and status. */
    items: string[];
    /** The store refs deleted. */
    store_refs: StoreRef[];
    /**
     * Refs the store failed to delete, and the items holding them: those
     * items were not erased (one deny event each); offboarding again erases them.
     */
    store_failures: { ref: StoreRef; error: string; items: string[] }[];
    /**
     * Refs the store refuses for good to let the plane delete
     * (NotDeletableError), and the erased items holding them: the record is
     * left in the store for the person to delete there.
     */
    left_in_store: { ref: StoreRef; error: string; items: string[] }[];
    /**
     * Refs the store held no record at when the erasure went to delete them
     * (a moved store, a record deleted outside the plane), and the erased
     * items holding them: not proven deleted, so their erase events keep the
     * erased content's hashes and adoption refuses that content in the
     * person scope under any id (review fix pass of PR #58, I-1).
     */
    not_found_in_store: { ref: StoreRef; items: string[] }[];
    /** Earlier events whose copy of an erased item, or lint evidence about one, was redacted. */
    events_redacted: number;
    /** Explanation rows removed. */
    explanation_rows: number;
  };
  /** What this erasure does not reach, in words; no content. */
  not_reached: string[];
  /** The events appended, in log order. */
  events: MemoryEvent[];
}

function checkRequest(request: unknown): OffboardRequest {
  const r = request as OffboardRequest;
  const bad = (what: string) => new InvalidCallError(`offboard: ${what}`);
  if (typeof r !== "object" || r === null) throw bad("the request is not an object");
  if (!Scope.safeParse(r.person).success || scopeLevel(r.person) !== "person")
    throw bad(`person ${JSON.stringify(r.person)} is not a person scope`);
  if (!Array.isArray(r.roles)) throw bad("roles is not a list");
  const seen = new Set<string>();
  for (const role of r.roles) {
    if (!Scope.safeParse(role?.scope).success || scopeLevel(role.scope) !== "role")
      throw bad(`${JSON.stringify(role?.scope)} is not a role scope`);
    if (seen.has(role.scope)) throw bad(`${role.scope} is handed over twice`);
    seen.add(role.scope);
    if (!Principal.safeParse(role.successor).success || role.successor === r.person)
      throw bad(`${role.scope}: the successor must be a principal other than the leaver`);
  }
  return r;
}

/** The item as the log keeps it after erasure: everything but what was remembered. */
function redacted(item: MemoryItem): MemoryItem {
  const content = item.class === "procedural" ? { body: REDACTED, tools: [] } : REDACTED;
  const { session_entry_id: _entry, ...provenance } = item.provenance;
  return {
    ...item,
    content,
    provenance: { ...provenance, ref: REDACTED, hash: REDACTED_HASH },
  } as MemoryItem;
}

/**
 * A lint event's reason once the evidence is erased: its lint id and severity
 * (plane/lint.ts writes `<lint_id> (<severity>): ...`), nothing else.
 */
function redactedLintReason(reason: string): string {
  const head = /^(\S+) \((info|warn|error)\): /.exec(reason);
  return head ? `${head[1]} (${head[2]}): ${REDACTED}` : REDACTED;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const refKey = (r: StoreRef) => `${r.adapter}\u0000${r.key}`;

async function run(
  deps: PlaneDeps,
  actor: Actor,
  request: OffboardRequest,
  at: string,
): Promise<DeletionReport> {
  const { db, adapter, newId } = deps;
  const { person, roles } = request;
  const base = { ts: at, actor: actor.id, schema_version: SCHEMA_VERSION as typeof SCHEMA_VERSION };
  const empty = {
    items: [],
    store_refs: [],
    store_failures: [],
    left_in_store: [],
    not_found_in_store: [],
    events_redacted: 0,
    explanation_rows: 0,
  };

  const scopes = [person, ...roles.map((r) => r.scope)];
  const outside = scopes.filter((s) => !actor.memberships.includes(s));
  if (actor.source !== "user" || outside.length > 0) {
    const reason =
      actor.source !== "user"
        ? `${actor.id} is not user-sourced; offboarding is a person's act, never an agent's`
        : `${actor.id} is not a member of ${outside.join(", ")}; only a member may offboard them`;
    const event = appendEvent(db, {
      ...base,
      id: newId(),
      op: "retire",
      item_id: null,
      scope_from: null,
      scope_to: null,
      decision: "deny",
      reason,
      policy_id: OFFBOARD_MEMBERSHIP_ID,
    });
    return {
      decision: "deny",
      reason,
      person,
      handover: [],
      erased: empty,
      not_reached: [],
      events: [event],
    };
  }

  const events: MemoryEvent[] = [];
  // The mark: what will be erased and handed over is read, and the erasure
  // marked as begun, in one transaction, before any store record is touched.
  const { projected, begun } = db.transaction(() => {
    const projected = currentItems(db);
    const erasing = projected.filter((i) => i.scope === person).length;
    const handing = roles.map((r) => `${r.scope} to ${r.successor}`).join(", ");
    const begun = appendEvent(db, {
      ...base,
      id: newId(),
      op: "retire",
      item_id: null,
      scope_from: person,
      scope_to: null,
      decision: "allow",
      reason: `offboarding of ${person} begun: ${erasing} item${erasing === 1 ? "" : "s"} to erase${handing ? `, handing over ${handing}` : ""}; until it completes, nothing in ${person} may change`,
      policy_id: OFFBOARD_BEGIN_ID,
    });
    return { projected, begun };
  });
  events.push(begun);

  // Handover: the leaver's items in each role become the successor's.
  const handover: DeletionReport["handover"] = [];
  const notHanded: { scope: string; successor: string; item: string }[] = [];
  for (const { scope, successor } of roles) {
    const moved: string[] = [];
    for (const first of projected.filter((i) => i.scope === scope && i.owner === person)) {
      let item: MemoryItem | undefined = first;
      let basis: Basis = { head: begun.seq, items: [first.id], scopes: [scope] };
      for (let attempt = 0; item && attempt < HANDOVER_ATTEMPTS; attempt++) {
        const current: MemoryItem = item;
        const next = { ...current, owner: successor, version: current.version + 1 } as MemoryItem;
        const storeFailed = (problem: string) =>
          // A decision like any other (AGENTS.md rule 3). Nothing is erased:
          // the items handed over so far are the successor's, and offboarding
          // again once the store recovers moves the rest, as it skips what moved.
          appendEvent(db, {
            ...base,
            id: newId(),
            op: "update",
            item_id: current.id,
            scope_from: scope,
            scope_to: scope,
            decision: "deny",
            reason: `the handover of ${scope} to ${successor} (${HANDOVER_ID}) failed in the store: ${problem}; nothing was erased`,
            policy_id: STORE_FAILURE_ID,
          });
        let store_ref: StoreRef;
        try {
          store_ref = await adapter.write({ ...next, store_ref: null } as MemoryItem);
        } catch (e) {
          storeFailed(errorText(e));
          throw e;
        }
        const ref = store_ref;
        const decided = basis;
        const out: { stale: string } | { event: MemoryEvent } = db.transaction(() => {
          const stale = staleness(
            db,
            decided,
            ownBytes(deps, { ...next, store_ref: ref } as MemoryItem),
          );
          if (stale) return { stale };
          return {
            event: appendEvent(db, {
              ...base,
              id: newId(),
              op: "update",
              item_id: current.id,
              scope_from: scope,
              scope_to: scope,
              decision: "allow",
              reason: `${scope} handed over from ${person} to ${successor} at offboarding`,
              policy_id: HANDOVER_ID,
              item: { ...next, store_ref: ref },
            }),
          };
        });
        if ("event" in out) {
          events.push(out.event);
          moved.push(current.id);
          break;
        }
        // Stale: the store is put back as the log has it, the refusal
        // recorded, and the item decided again as it now stands.
        const last = attempt === HANDOVER_ATTEMPTS - 1;
        const stale = {
          wrote: { ...next, store_ref: ref } as MemoryItem,
          head: decided.head,
          actor: actor.id,
          at,
        };
        try {
          events.push(
            await settle(deps, current.id, ref, stale, (note) =>
              appendEvent(db, {
                ...base,
                id: newId(),
                op: "update",
                item_id: current.id,
                scope_from: scope,
                scope_to: scope,
                decision: "deny",
                reason: `the handover of ${current.id} in ${scope} to ${successor} was decided on version ${current.version}, but ${out.stale}; that handover is refused and the store is put back as the log has it; ${last ? `this was attempt ${HANDOVER_ATTEMPTS} of ${HANDOVER_ATTEMPTS}, so no further attempt is made` : "the item is handed over again as it now stands if the leaver still owns it"}${note}`,
                policy_id: HANDOVER_CONFLICT_ID,
              }),
            ),
          );
        } catch (e) {
          storeFailed(
            `the handover was refused (${HANDOVER_CONFLICT_ID}: ${out.stale}) and the store could not be put back: ${errorText(e)}`,
          );
          throw e;
        }
        const again: { head: number; now: MemoryItem | undefined } = db.transaction(() => ({
          head: logHead(db),
          now: itemById(db, current.id),
        }));
        item = again.now?.scope === scope && again.now.owner === person ? again.now : undefined;
        basis = { head: again.head, items: [current.id], scopes: [scope] };
        if (last && item) {
          // Still the leaver's after every attempt: left, and said so.
          events.push(
            appendEvent(db, {
              ...base,
              id: newId(),
              op: "update",
              item_id: current.id,
              scope_from: scope,
              scope_to: scope,
              decision: "deny",
              reason: `${current.id} in ${scope} was not handed over to ${successor}: it changed on another handle of this log during each of ${HANDOVER_ATTEMPTS} attempts; it stays ${person}'s, and offboarding again hands it over`,
              policy_id: NOT_HANDED_OVER_ID,
            }),
          );
          notHanded.push({ scope, successor, item: current.id });
        }
      }
    }
    handover.push({ scope, successor, items: moved });
  }

  // Erasure: every version in the person scope, from the store first.
  const doomed = projected.filter((i) => i.scope === person);
  const doomedIds = new Set(doomed.map((i) => i.id));
  // A ref an item outside the person scope also holds (a version of the same
  // store record, as adoption makes) stays: deleting it would delete that
  // item's bytes from a scope the leaver does not own alone.
  const held = new Set(
    currentItems(db)
      .filter((i) => !doomedIds.has(i.id) && i.store_ref)
      .map((i) => refKey(i.store_ref as StoreRef)),
  );
  const refs = new Map<string, StoreRef>();
  const shared = new Set<string>();
  for (const i of doomed) {
    if (!i.store_ref) continue;
    const key = refKey(i.store_ref);
    if (held.has(key)) shared.add(key);
    else refs.set(key, i.store_ref);
  }
  const deleted: StoreRef[] = [];
  const failed = new Map<string, string>();
  const refused = new Map<string, string>();
  // A ref the store holds no record at: deleting it succeeds under the
  // adapter contract, but proves nothing. The store may have moved (a files
  // folder renamed while the plane names the old root) and still hold the
  // record elsewhere, so its content is kept refused (review fix pass of PR
  // #58, I-1). A read that throws means a record is there: it is deleted.
  const missing = new Set<string>();
  for (const [key, ref] of refs) {
    try {
      const present = await adapter.read(ref).then(
        (r) => r !== undefined,
        () => true,
      );
      if (!present) {
        missing.add(key);
        continue;
      }
      await adapter.delete(ref);
      deleted.push(ref);
    } catch (e) {
      (isNotDeletable(e) ? refused : failed).set(key, errorText(e));
    }
  }
  // An item whose ref the store failed to delete is not erased this time: its
  // bytes are still in the store, so erasing it from the log would let
  // adoption bring it back with nothing recording what happened.
  const keptBack = doomed.filter((i) => i.store_ref && failed.has(refKey(i.store_ref)));
  const toErase = doomed.filter((i) => !keptBack.includes(i));
  const byRef = (errors: Map<string, string>, holders: MemoryItem[]) =>
    [...errors].map(([key, error]) => ({
      ref: refs.get(key) as StoreRef,
      error,
      items: holders
        .filter((i) => refKey(i.store_ref as StoreRef) === key)
        .map((i) => i.id)
        .sort(),
    }));
  const failures: DeletionReport["erased"]["store_failures"] = byRef(failed, keptBack);
  for (const i of keptBack)
    events.push(
      appendEvent(db, {
        ...base,
        id: newId(),
        op: "retire",
        item_id: i.id,
        scope_from: person,
        scope_to: null,
        decision: "deny",
        reason: `the erasure of ${i.id} with ${person} (${ERASURE_ID}) failed in the store: ${failed.get(refKey(i.store_ref as StoreRef))}; it is kept in the store, the projection and the log, and offboarding again once the store recovers erases it`,
        policy_id: STORE_FAILURE_ID,
      }),
    );
  // The content of each record left in the store, as the store holds it now:
  // adoption refuses exactly these bytes (and the erased versions') later.
  const leftContent = new Map<string, Set<string>>();
  for (const i of toErase) {
    if (i.store_ref && missing.has(refKey(i.store_ref))) {
      // No record to read; the erased versions' hashes are added below.
      leftContent.set(i.id, new Set([mergingContentHash(i.content)]));
      continue;
    }
    if (!i.store_ref || !refused.has(refKey(i.store_ref))) continue;
    const hashes = new Set([mergingContentHash(i.content)]);
    try {
      const record = await adapter.read(i.store_ref);
      if (record) hashes.add(mergingContentHash(record.content));
    } catch {
      // The store cannot read it back either; the erased versions still count.
    }
    leftContent.set(i.id, hashes);
  }
  /** What happened to an erased item's bytes in the store. */
  const inStore = (i: MemoryItem) =>
    !i.store_ref
      ? "it had no store record"
      : shared.has(refKey(i.store_ref))
        ? `kept in the store, whose record an item outside ${person} also holds`
        : refused.has(refKey(i.store_ref))
          ? `left in the store, which refuses the plane's delete (${refused.get(refKey(i.store_ref))}); the person deletes it there`
          : missing.has(refKey(i.store_ref))
            ? `${NOT_FOUND_CLAUSE} (the store may have moved, or the record was deleted outside the plane)`
            : "deleted from the store";

  const { erased, redactedEvents, explanationRows } = db.transaction(() => {
    // Erased: what was read at the mark and the projection still holds, as
    // it holds it now. Nothing in the person scope can have changed since
    // the mark but a retirement (no store write); an item a concurrent
    // offboarding on another handle erased already is gone.
    const erased = toErase.flatMap((i) => itemById(db, i.id) ?? []);
    const ids = new Set(erased.map((i) => i.id));
    let redactedEvents = 0;
    let explanationRows = 0;
    const update = db.prepare("UPDATE events SET body = ? WHERE id = ?");
    // What lint evidence about an erased item may hold: its id, and the
    // content and evidence hashes of every version the log carries. A hash a
    // surviving item also holds (its content or its provenance hash), or an
    // evidence hash of a source that survives, is not the erased item's alone:
    // it stays readable in that item, so matching it would only redact
    // findings about surviving items (review of PR #41).
    const surviving = currentItems(db).filter((i) => !ids.has(i.id));
    const survivingHashes = new Set(
      surviving.flatMap((i) => [strictContentHash(i.content), i.provenance.hash]),
    );
    const survivingIds = new Set(surviving.map((i) => i.id));
    const hashes = new Set<string>();
    for (const i of erased) hashes.add(strictContentHash(i.content));
    for (const id of ids) {
      for (const row of db.prepare("SELECT id, body FROM events WHERE item_id = ?").all(id)) {
        const event = JSON.parse(String(row.body)) as MemoryEvent;
        if (!event.item) continue;
        hashes.add(strictContentHash(event.item.content));
        leftContent.get(id)?.add(mergingContentHash(event.item.content));
        const source = refItemId(event.item.provenance.ref);
        if (source === null || !survivingIds.has(source)) hashes.add(event.item.provenance.hash);
        update.run(JSON.stringify({ ...event, item: redacted(event.item) }), String(row.id));
        redactedEvents++;
      }
      explanationRows += Number(
        db.prepare("DELETE FROM explanations WHERE item_id = ?").run(id).changes,
      );
    }
    hashes.delete(REDACTED_HASH);
    const traces = [...ids, ...[...hashes].filter((h) => !survivingHashes.has(h))];
    // Lint events (card L1) carry no item, only an id and evidence in their
    // reason: about an erased item, or naming one, the evidence goes.
    if (ids.size > 0)
      for (const row of db.prepare("SELECT id, body FROM events WHERE op = 'lint'").all()) {
        const event = JSON.parse(String(row.body)) as MemoryEvent;
        const about = event.item_id !== null && ids.has(event.item_id);
        if (!about && !traces.some((t) => event.reason.includes(t))) continue;
        const reason = redactedLintReason(event.reason);
        if (reason === event.reason) continue;
        update.run(JSON.stringify({ ...event, reason }), String(row.id));
        redactedEvents++;
      }
    for (const i of erased)
      events.push(
        appendEvent(db, {
          ...base,
          id: newId(),
          op: "retire",
          item_id: i.id,
          scope_from: person,
          scope_to: null,
          decision: "allow",
          reason: `erased with ${person} at offboarding: ${inStore(i)}; removed from the projection and redacted in the log's copies${leftContent.has(i.id) ? `; ${LEFT_CONTENT_CLAUSE} (${[...(leftContent.get(i.id) as Set<string>)].sort().join(", ")})` : ""}`,
          policy_id: ERASURE_ID,
        }),
      );
    return { erased, redactedEvents, explanationRows };
  });
  const ids = new Set(erased.map((i) => i.id));
  const leftInStore: DeletionReport["erased"]["left_in_store"] = byRef(refused, erased);
  const notFound: DeletionReport["erased"]["not_found_in_store"] = byRef(
    new Map([...missing].map((key) => [key, ""])),
    erased,
  ).map(({ ref, items }) => ({ ref, items }));

  // The sweep (verification of PR #50, V-1 and V-5; pass 3, V3-1, V3-2). It
  // deletes, one event each, what a store still holds that no projected item
  // holds and that the erasure must not leave behind: in the person scope, a
  // record under an id the log never allowed (a write that never committed:
  // a writer that crashed, or one decided before an earlier offboarding
  // stopped) or under an erased id whose record the erasure deleted; in every
  // scope the log names, a record whose lineage names an erased or swept id
  // (a promotion's new version that never committed). A record an item
  // outside the person scope holds by its ref stays. Each deletion follows
  // the store-then-log protocol (commit.ts): the log's head is noted before
  // the listing, and if the record's item changed since (a write committed
  // meanwhile, by another handle), the projected item is written back and no
  // swept event is appended. A store that refuses the delete for good leaves
  // the record refused while it holds that content, as an erasure's
  // left-in-store record is (V3-7).
  let swept = 0;
  let sweepFailed = 0;
  const others = db
    .prepare(
      `SELECT DISTINCT scope_to AS scope FROM events WHERE scope_to IS NOT NULL
       UNION SELECT DISTINCT scope_from AS scope FROM events WHERE scope_from IS NOT NULL`,
    )
    .all()
    .map((r) => String(r.scope))
    .filter((sc) => sc !== person)
    .sort();
  for (const scope of [person, ...others]) {
    const head = logHead(db);
    for (const record of await adapter.list(scope)) {
      const record_ref = record.store_ref;
      if (!record_ref) continue;
      const what = db.transaction((): string | null => {
        if (itemById(db, record.id)) return null;
        // A ref an item outside the person scope holds stays (review of PR #33).
        if (itemsByStoreRef(db, record_ref).length > 0) return null;
        const ancestor = removedAncestor(db, record);
        if (ancestor)
          return `a record, item ${record.id} in ${scope}, whose lineage names item ${ancestor}, which an offboarding of ${person} took out`;
        if (scope !== person) return null;
        const history = eventsByItem(db, record.id);
        const gone = history.filter(erases).at(-1);
        if (gone && keptInStore(gone)) return null;
        if (gone)
          return `a record under the id of item ${record.id}, which this or an earlier offboarding of ${person} erased`;
        if (history.some((e) => e.decision === "allow")) return null;
        return `a record under item id ${record.id}, which no allowed event of the log ever recorded: a write that never committed`;
      });
      if (what === null) continue;
      let failure: string | null = null;
      let forGood = false;
      try {
        await adapter.delete(record_ref);
      } catch (e) {
        forGood = isNotDeletable(e);
        failure = forGood
          ? `the store refuses the delete for good: ${errorText(e)}; the record stays there, refused while it holds this content`
          : `the delete failed: ${errorText(e)}; the record stays there, and adoption refuses it and deletes it`;
      }
      const outcome = db.transaction(() => {
        // Committed meanwhile on another handle: the sweep's decision is stale.
        if (touchedSince(db, record.id, head)) return null;
        return appendEvent(db, {
          ...base,
          id: newId(),
          op: "retire",
          item_id: record.id,
          scope_from: scope,
          scope_to: null,
          decision: failure ? "deny" : "allow",
          reason: failure
            ? `${what}, left in the store, was to be deleted at offboarding, but ${failure}${forGood ? `; ${LEFT_CONTENT_CLAUSE} (${mergingContentHash(record.content)})` : ""}`
            : `${what}, left in the store, was deleted at offboarding`,
          policy_id: OFFBOARD_SWEPT_ID,
        });
      });
      if (outcome) {
        events.push(outcome);
        if (failure) sweepFailed++;
        else swept++;
        continue;
      }
      // Put back what the log now holds for it, as a stale writer does.
      for (let round = 0; round < 4; round++) {
        const { again, now } = db.transaction(() => ({
          again: logHead(db),
          now: itemById(db, record.id),
        }));
        if (!now || now.store_ref?.key !== record_ref.key) break;
        await adapter.write({ ...now, store_ref: null } as MemoryItem);
        if (!db.transaction(() => touchedSince(db, record.id, again))) break;
      }
    }
  }

  const kept = projected.filter(
    (i) => i.owner === person && i.scope !== person && !roles.some((r) => r.scope === i.scope),
  ).length;
  const not_reached = [
    "the log keeps each erased item's id, scope, owner, class, times and every decision made about it; its content, provenance ref and evidence hash are redacted",
    ...(adapter.capabilities.native_history
      ? [
          `the store ${adapter.name} keeps a history of its own, which may still hold the erased items; erase them there`,
        ]
      : []),
    "copies outside this log are not reached: pi session files that mirrored these events, and any backup of the store or the log",
    ...(kept > 0
      ? [
          `${kept} item${kept === 1 ? "" : "s"} the leaver owns in shared scopes are kept: they are the scope's, not the person's`,
        ]
      : []),
    ...(shared.size > 0
      ? [
          `${shared.size} store ref${shared.size === 1 ? " is" : "s are"} kept in the store: held by an item outside ${person} as well, so deleting ${shared.size === 1 ? "it" : "them"} would delete that item; the log's copies of the erased items are redacted all the same`,
        ]
      : []),
    ...(leftInStore.length > 0
      ? [
          `${leftInStore.length} store record${leftInStore.length === 1 ? " is" : "s are"} left in the store ${adapter.name}, which refuses the plane's delete: see left_in_store; the person deletes ${leftInStore.length === 1 ? "it" : "them"} there; adoption refuses ${leftInStore.length === 1 ? "it" : "them"} while ${leftInStore.length === 1 ? "it holds" : "they hold"} the erased content, and the log keeps that content's hash, which can confirm a guess of short content`,
        ]
      : []),
    ...(swept + sweepFailed > 0
      ? [
          `${swept + sweepFailed} record${swept + sweepFailed === 1 ? "" : "s"} left in the store of ${person} under an erased id or one the log never recorded ${swept + sweepFailed === 1 ? "was" : "were"} swept (${OFFBOARD_SWEPT_ID}): ${swept} deleted, ${sweepFailed} the store would not delete, which adoption refuses`,
        ]
      : []),
    ...(notFound.length > 0
      ? [
          `${notFound.length} store ref${notFound.length === 1 ? " holds" : "s hold"} no record in the store ${adapter.name}, so what was there is not proven deleted: see not_found_in_store; if the store moved (a renamed folder), the records are still there, and the person deletes them; adoption refuses their content in ${person} under any id, and the log keeps that content's hash, which can confirm a guess of short content`,
        ]
      : []),
    ...notHanded.map(
      (n) =>
        `${n.item} in ${n.scope} was not handed over to ${n.successor}: it kept changing on another handle (${NOT_HANDED_OVER_ID}); it stays the leaver's until offboarding runs again`,
    ),
    ...(failures.length > 0
      ? [
          `${failures.length} store ref${failures.length === 1 ? "" : "s"} could not be deleted, so the ${keptBack.length} item${keptBack.length === 1 ? " holding it was" : "s holding them were"} not erased: see store_failures; offboarding again once the store recovers erases ${keptBack.length === 1 ? "it" : "them"}`,
        ]
      : []),
  ];
  const keptClause = keptBack.length > 0 ? `${keptBack.length} kept after a store failure, ` : "";
  const leftClause =
    (notHanded.length > 0 ? `, ${notHanded.length} not handed over` : "") +
    (swept + sweepFailed > 0 ? `, ${swept + sweepFailed} left records swept` : "");
  const reason = `offboarded ${person}: ${ids.size} items erased, ${keptClause}${handover.reduce((n, h) => n + h.items.length, 0)} handed over in ${roles.length} role scope${roles.length === 1 ? "" : "s"}${leftClause}`;
  events.push(
    appendEvent(db, {
      ...base,
      id: newId(),
      op: "retire",
      item_id: null,
      scope_from: person,
      scope_to: null,
      decision: "allow",
      reason: `${reason}; ${closesClause(begun.id)}`,
      policy_id: OFFBOARD_REPORT_ID,
    }),
  );
  return {
    decision: "allow",
    reason,
    person,
    handover,
    erased: {
      items: [...ids].sort(),
      store_refs: deleted,
      store_failures: failures,
      left_in_store: leftInStore,
      not_found_in_store: notFound,
      events_redacted: redactedEvents,
      explanation_rows: explanationRows,
    },
    not_reached,
    events,
  };
}

/**
 * Offboards a person (card E9.7): hands each role scope to its successor and
 * erases the person scope, returning the deletion report. Runs in the write
 * queue. An invalid actor, time or request is refused with InvalidCallError
 * before the log or the store is touched.
 */
export async function offboard(
  deps: PlaneDeps,
  actor: Actor,
  request: OffboardRequest,
  at: string,
): Promise<DeletionReport> {
  checkCall(actor, at, "offboard");
  const checked = checkRequest(request);
  return inWriteQueue(deps.db, () => run(deps, actor, checked, at));
}
