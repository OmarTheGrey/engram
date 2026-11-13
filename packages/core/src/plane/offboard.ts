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
// and only for records still in a store (ADR 0010, recheck of PR #41).
//
// The deletion report names what was erased and handed over, by id, and what
// this call cannot reach. It carries no content. One summary event
// (`engram/offboard/report`) records the offboarding in the log.
//
// Who may offboard: a user-sourced actor who is a member of the person scope
// and of every role scope handed over, else one deny event
// (`engram/offboard/membership`) and nothing changes. Memberships are the
// harness's and, without authentication, self-asserted (ADR 0027): through
// the CLI this is only as strong as the machine it runs on.
import { type Actor, checkCall, InvalidCallError } from "../actor.ts";
import { isNotDeletable, type StoreRef } from "../adapter.ts";
import { mergingContentHash, strictContentHash } from "../content-hash.ts";
import { appendEvent, currentItems, ERASURE_ID, LEFT_CONTENT_CLAUSE } from "../events.ts";
import { refItemId } from "../lint/det.ts";
import type { PlaneDeps } from "../plane.ts";
import { STORE_FAILURE_ID, scopeLevel } from "../policy/evaluate.ts";
import { type MemoryEvent, type MemoryItem, Principal, SCHEMA_VERSION, Scope } from "../schema.ts";
import { inWriteQueue } from "./queue.ts";

export const HANDOVER_ID = "engram/offboard/handover";
export const OFFBOARD_MEMBERSHIP_ID = "engram/offboard/membership";
export const OFFBOARD_REPORT_ID = "engram/offboard/report";
export { ERASURE_ID };

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
  const projected = currentItems(db);

  // Handover: the leaver's items in each role become the successor's.
  const handover: DeletionReport["handover"] = [];
  for (const { scope, successor } of roles) {
    const moved: string[] = [];
    for (const item of projected.filter((i) => i.scope === scope && i.owner === person)) {
      const next = { ...item, owner: successor, version: item.version + 1 } as MemoryItem;
      let store_ref: StoreRef;
      try {
        store_ref = await adapter.write({ ...next, store_ref: null } as MemoryItem);
      } catch (e) {
        // A decision like any other (AGENTS.md rule 3). Nothing is erased: the
        // items handed over so far are the successor's, and offboarding again
        // once the store recovers moves the rest, as it skips what moved.
        appendEvent(db, {
          ...base,
          id: newId(),
          op: "update",
          item_id: item.id,
          scope_from: scope,
          scope_to: scope,
          decision: "deny",
          reason: `the handover of ${scope} to ${successor} (${HANDOVER_ID}) failed in the store: ${errorText(e)}; nothing was erased`,
          policy_id: STORE_FAILURE_ID,
        });
        throw e;
      }
      events.push(
        appendEvent(db, {
          ...base,
          id: newId(),
          op: "update",
          item_id: item.id,
          scope_from: scope,
          scope_to: scope,
          decision: "allow",
          reason: `${scope} handed over from ${person} to ${successor} at offboarding`,
          policy_id: HANDOVER_ID,
          item: { ...next, store_ref },
        }),
      );
      moved.push(item.id);
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
  for (const [key, ref] of refs) {
    try {
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
  const erased = doomed.filter((i) => !keptBack.includes(i));
  const ids = new Set(erased.map((i) => i.id));
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
  const leftInStore: DeletionReport["erased"]["left_in_store"] = byRef(refused, erased);
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
  for (const i of erased) {
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
          : "deleted from the store";

  const { redactedEvents, explanationRows } = db.transaction(() => {
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
    return { redactedEvents, explanationRows };
  });

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
    ...(failures.length > 0
      ? [
          `${failures.length} store ref${failures.length === 1 ? "" : "s"} could not be deleted, so the ${keptBack.length} item${keptBack.length === 1 ? " holding it was" : "s holding them were"} not erased: see store_failures; offboarding again once the store recovers erases ${keptBack.length === 1 ? "it" : "them"}`,
        ]
      : []),
  ];
  const keptClause = keptBack.length > 0 ? `${keptBack.length} kept after a store failure, ` : "";
  const reason = `offboarded ${person}: ${ids.size} items erased, ${keptClause}${handover.reduce((n, h) => n + h.items.length, 0)} handed over in ${roles.length} role scope${roles.length === 1 ? "" : "s"}`;
  events.push(
    appendEvent(db, {
      ...base,
      id: newId(),
      op: "retire",
      item_id: null,
      scope_from: person,
      scope_to: null,
      decision: "allow",
      reason,
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
