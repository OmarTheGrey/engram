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
// trail of what was decided is kept without what was remembered.
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
import type { StoreRef } from "../adapter.ts";
import { appendEvent, currentItems, ERASURE_ID } from "../events.ts";
import type { PlaneDeps } from "../plane.ts";
import { scopeLevel } from "../policy/evaluate.ts";
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
    /** Refs the store failed to delete: still in the store, to be deleted there. */
    store_failures: { ref: StoreRef; error: string }[];
    /** Earlier events whose copy of an erased item was redacted. */
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
      const store_ref = await adapter.write({ ...next, store_ref: null } as MemoryItem);
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
  const ids = new Set(doomed.map((i) => i.id));
  const refs = new Map<string, StoreRef>();
  for (const i of doomed) if (i.store_ref) refs.set(refKey(i.store_ref), i.store_ref);
  const deleted: StoreRef[] = [];
  const failures: DeletionReport["erased"]["store_failures"] = [];
  for (const ref of refs.values()) {
    try {
      await adapter.delete(ref);
      deleted.push(ref);
    } catch (e) {
      failures.push({ ref, error: errorText(e) });
    }
  }

  const { redactedEvents, explanationRows } = db.transaction(() => {
    let redactedEvents = 0;
    let explanationRows = 0;
    const update = db.prepare("UPDATE events SET body = ? WHERE id = ?");
    for (const id of ids) {
      for (const row of db.prepare("SELECT id, body FROM events WHERE item_id = ?").all(id)) {
        const event = JSON.parse(String(row.body)) as MemoryEvent;
        if (!event.item) continue;
        update.run(JSON.stringify({ ...event, item: redacted(event.item) }), String(row.id));
        redactedEvents++;
      }
      explanationRows += Number(
        db.prepare("DELETE FROM explanations WHERE item_id = ?").run(id).changes,
      );
    }
    for (const id of ids)
      events.push(
        appendEvent(db, {
          ...base,
          id: newId(),
          op: "retire",
          item_id: id,
          scope_from: person,
          scope_to: null,
          decision: "allow",
          reason: `erased with ${person} at offboarding: deleted from the store, the projection and the log's copies`,
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
    ...(failures.length > 0
      ? [
          `${failures.length} store ref${failures.length === 1 ? "" : "s"} could not be deleted: see store_failures`,
        ]
      : []),
  ];
  const reason = `offboarded ${person}: ${ids.size} items erased, ${handover.reduce((n, h) => n + h.items.length, 0)} handed over in ${roles.length} role scope${roles.length === 1 ? "" : "s"}`;
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
