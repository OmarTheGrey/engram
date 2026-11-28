// The approval queue (card E2.19 of the second absorb plan): a pure
// projection over the log, with no table and no event field of its own
// (docs/log/2026-11-25-ap2-decision-approvals-without-schema.md). A request
// is keyed by its item's id and version, so one version has at most one.
//
// A request opens at the first of:
//   - a held write: an allowed `write` or `update` whose item lands as a
//     candidate (a scope that requires review, the injection screen's or a
//     content guard's hold, an import); its target is the item's scope;
//   - a `gate` event with decision `ask` that Plane.promote appends when a
//     promotion waits for a reviewer; its target is the event's `scope_to`.
// A later ask on the same version joins the open request and does not
// reopen or extend it. It closes at the first of:
//   approved  an allowed `promote` of the item (in place, or a new version
//             whose lineage starts at it);
//   expired   a `promote` deny under `engram/approval/expired`: the sweep
//             (expireRequests) or a promotion attempted after the expiry;
//   denied    an approver's refusal (`engram/approval/refused`: a `retire`
//             of a candidate, or a `promote` deny for the widening of an
//             active item), or any other allowed retire, evict or erasure of
//             the item, or a rewrite to another version (which, if it is
//             still a candidate, opens the new version's request).
// A request past its route's `expires_after` and not yet closed is still
// `pending`, marked `due`: the projection decides nothing, so an expiry is
// only ever what an event records (AGENTS.md rule 3).
//
// Routing is the policy's `approval` block (routeFor, policy/promotion.ts):
// a route narrows ADR 0026's eligible reviewers and never widens them, and
// `owner` is ADR 0049's owner acceptance. No approver may approve or refuse
// their own write: the reviewer rule (reviewerProblem) is asked first. The
// stale-base refusal of obsidian-wiki's staging (MIT, Ar9av/obsidian-wiki at
// 7da8def05ab4, obsidian_wiki/staging.py; ported as an idea and restated
// here, no code copied) is the version key: a decision is about the version
// the request was opened on, and a rewrite closes it.
import { type Actor, checkCall, InvalidCallError } from "../actor.ts";
import { allEvents, appendEvent, applyEvent, erases } from "../events.ts";
import { itemById } from "../items.ts";
import type { GateResult, PlaneDeps } from "../plane.ts";
import { readableScope } from "../policy/evaluate.ts";
import {
  APPROVAL_EXPIRED_ID,
  APPROVAL_ROUTE_ID,
  approverNames,
  canReach,
  ownCandidate,
  PROMOTE_MEMBERSHIP_ID,
  PROMOTE_REVIEWER_ID,
  reviewerProblem,
  routeFor,
  routeText,
} from "../policy/promotion.ts";
import { Id, type MemoryEvent, type MemoryItem, type Policy, Scope } from "../schema.ts";
import { addSeconds, compareTimestamps } from "../time.ts";
import { authorsOf } from "./promote.ts";
import { inWriteQueue } from "./queue.ts";

export { APPROVAL_EXPIRED_ID, APPROVAL_ROUTE_ID };
/** An approver's refusal of a request (card E2.19). */
export const APPROVAL_REFUSED_ID = "engram/approval/refused";
/** A refusal asked for an item version with no pending request. */
export const APPROVAL_NO_REQUEST_ID = "engram/approval/no-request";
/** A sweep of a scope's requests by an actor who is not a member of it. */
export const APPROVAL_MEMBERSHIP_ID = "engram/approval/membership";

export type RequestState = "pending" | "approved" | "denied" | "expired";

/** One request of the approval queue, as the log gives it. */
export interface ApprovalRequest {
  item_id: string;
  /** The item's version the request was opened on. */
  version: number;
  /** The item's scope when the request opened. */
  scope: string;
  /** Where the promotion would land. */
  target: string;
  /** The event that opened it (a held write or a `gate` ask), its time and its actor. */
  opened_by: string;
  opened_at: string;
  requester: string;
  /** The route's scope or level, or null when no route applies (ADR 0026's reviewers). */
  route: string | null;
  /** The route's approvers; empty when no route applies. */
  approvers: string[];
  /** When it expires unanswered; null when its route sets no expiry, or none applies. */
  expires_at: string | null;
  state: RequestState;
  /** Pending and past `expires_at` at the time asked: the next sweep or attempt records the expiry. */
  due: boolean;
  /** The event that closed it, with its rule and actor; null while pending. */
  closed_by: string | null;
  closed_at: string | null;
  closed_under: string | null;
  closer: string | null;
}

function opened(policy: Policy, e: MemoryEvent, item: MemoryItem, target: string): ApprovalRequest {
  const route = routeFor(policy, target);
  const expires = route?.expires_after === undefined ? null : addSeconds(e.ts, route.expires_after);
  return {
    item_id: item.id,
    version: item.version,
    scope: item.scope,
    target,
    opened_by: e.id,
    opened_at: e.ts,
    requester: e.actor,
    route: route?.scope ?? null,
    approvers: route ? [...route.approvers] : [],
    expires_at: expires,
    state: "pending",
    due: false,
    closed_by: null,
    closed_at: null,
    closed_under: null,
    closer: null,
  };
}

/** How `e` closes an open request on item `id`, or null when it does not. */
function closing(e: MemoryEvent, id: string, version: number): RequestState | null {
  if (e.op === "promote" && e.decision === "allow")
    return e.item_id === id || e.item?.lineage[0] === id ? "approved" : null;
  if (e.item_id !== id) return null;
  if (e.op === "promote" && e.decision === "deny") {
    if (e.policy_id === APPROVAL_EXPIRED_ID) return "expired";
    if (e.policy_id === APPROVAL_REFUSED_ID) return "denied";
    return null;
  }
  if (e.decision !== "allow") return null;
  if (e.op === "retire" || e.op === "evict") return "denied";
  if ((e.op === "write" || e.op === "update") && e.item && e.item.version !== version)
    return "denied";
  return null;
}

/**
 * The approval queue at `at` (card E2.19): every request the log opened, in
 * the order they opened, each with its routing under `policy`, its expiry
 * and its state. Pure: no I/O, no clock; `at` only marks a pending request
 * `due`.
 */
export function approvalQueue(
  policy: Policy,
  events: readonly MemoryEvent[],
  at: string,
): ApprovalRequest[] {
  const items = new Map<string, MemoryItem>();
  const open = new Map<string, ApprovalRequest>();
  const out: ApprovalRequest[] = [];
  for (const e of events) {
    for (const [id, r] of open) {
      const state = closing(e, id, r.version);
      if (state === null) continue;
      Object.assign(r, {
        state,
        closed_by: e.id,
        closed_at: e.ts,
        closed_under: e.policy_id,
        closer: e.actor,
      });
      open.delete(id);
    }
    if (e.item_id !== null) {
      if (erases(e)) items.delete(e.item_id);
      else {
        const after = applyEvent(items.get(e.item_id), e);
        if (after) items.set(e.item_id, after);
      }
    }
    const held =
      (e.op === "write" || e.op === "update") &&
      e.decision === "allow" &&
      e.item?.status === "candidate";
    const asked = e.op === "gate" && e.decision === "ask" && e.item_id !== null;
    if (!held && !asked) continue;
    const id = e.item_id as string;
    const item = items.get(id);
    if (!item || open.has(id)) continue;
    const r = opened(policy, e, item, held ? item.scope : (e.scope_to ?? item.scope));
    open.set(id, r);
    out.push(r);
  }
  for (const r of open.values())
    r.due = r.expires_at !== null && compareTimestamps(r.expires_at, at) <= 0;
  return out;
}

/**
 * The expired request of `item`'s current version at `at`, for the
 * promotion evaluator's evidence (`expiredRequest`): closed as expired, or
 * pending and due. Undefined when the policy has no approval block, so a
 * policy without one gathers nothing and decides as before.
 */
export function expiredRequestOf(
  deps: PlaneDeps,
  item: MemoryItem,
  at: string,
): { expiredRequest: { expires_at: string; opened_by: string } } | Record<string, never> {
  if (deps.policy.approval === undefined) return {};
  const r = approvalQueue(deps.policy, allEvents(deps.db), at).find(
    (q) => q.item_id === item.id && q.version === item.version,
  );
  if (!r || r.expires_at === null || !(r.state === "expired" || r.due)) return {};
  return { expiredRequest: { expires_at: r.expires_at, opened_by: r.opened_by } };
}

/** The pending request on `item`'s current version, if any. */
function pendingOf(deps: PlaneDeps, item: MemoryItem, at: string): ApprovalRequest | undefined {
  return approvalQueue(deps.policy, allEvents(deps.db), at).find(
    (q) => q.item_id === item.id && q.version === item.version && q.state === "pending",
  );
}

/**
 * Why `actor` may not decide (approve or refuse) a request on `item` into
 * `target`, with the rule, or null: the promotion gate's own reviewer rules
 * (ADR 0026 as ADR 0049 amends it: a member of the item's scope, or its
 * owner there; user-sourced; not its owner, nor an author of any version;
 * the owner accepting their own semantic candidate in their person scope
 * apart), then the target's route.
 */
export function deciderProblem(
  deps: PlaneDeps,
  actor: Actor,
  item: MemoryItem,
  target: string,
): { policy_id: string; reason: string } | null {
  const ownPerson = actor.id === item.owner && item.scope === actor.id;
  if (!actor.memberships.includes(item.scope) && !ownPerson)
    return {
      policy_id: PROMOTE_MEMBERSHIP_ID,
      reason: `${actor.id} is not a member of ${item.scope}, so cannot decide a request on its items`,
    };
  const accepting = ownCandidate(actor, item, target);
  if (accepting && actor.source !== "user")
    return {
      policy_id: PROMOTE_REVIEWER_ID,
      reason: `${actor.id} acts with source ${actor.source ?? "none"}; only the owner acting as user decides a request in their own person scope`,
    };
  if (!accepting) {
    const problem = reviewerProblem(actor, item, target, authorsOf(deps, item));
    if (problem) return { policy_id: PROMOTE_REVIEWER_ID, reason: problem };
  }
  const route = routeFor(deps.policy, target);
  if (route && !route.approvers.some((a) => approverNames(a, actor, accepting)))
    return {
      policy_id: APPROVAL_ROUTE_ID,
      reason: `${actor.id} is not an approver of requests into ${target}: the policy routes them to ${routeText(route)}`,
    };
  return null;
}

/** A request as Plane.approvals shows it to one actor. */
export interface QueuedRequest extends ApprovalRequest {
  /** The actor may approve or refuse it now: pending, not due, and the actor an approver. */
  may_decide: boolean;
}

/**
 * Plane.approvals: the queue at `at` as `actor` may see it, every request
 * whose item's scope the actor may read as a member (the read matrix), in
 * the order they opened, each saying whether the actor may decide it now.
 * Decides nothing and appends no event.
 */
export async function approvals(
  deps: PlaneDeps,
  actor: Actor,
  at: string,
): Promise<QueuedRequest[]> {
  checkCall(actor, at, "approvals");
  const out: QueuedRequest[] = [];
  for (const r of approvalQueue(deps.policy, allEvents(deps.db), at)) {
    if (!readableScope(deps.policy, actor, r.scope)) continue;
    const item = itemById(deps.db, r.item_id);
    const live = r.state === "pending" && !r.due && item?.version === r.version;
    out.push({
      ...r,
      may_decide: live && deciderProblem(deps, actor, item as MemoryItem, r.target) === null,
    });
  }
  return out;
}

/** What a sweep of one scope's requests did (Plane.expireRequests). */
export interface ExpiryReport {
  /** `deny` when the actor is not a member of the scope; nothing was swept. */
  decision: "allow" | "deny";
  /** Every event the sweep appended, in log order. */
  events: MemoryEvent[];
  /** The items whose requests it recorded as expired. */
  expired: string[];
}

function expiryReason(r: ApprovalRequest, at: string): string {
  return `the request for item ${r.item_id} at version ${r.version} into ${r.target}, opened by event ${r.opened_by} at ${r.opened_at}, expired at ${r.expires_at} with no approver's decision (routed to ${r.approvers.join(", ")}, the approval route for ${r.route}); recorded at ${at}, it is denied and the item is not promoted`;
}

/**
 * Plane.expireRequests: records every request on an item of `scope` that is
 * due at `at` as expired, one `promote` deny event each under
 * `engram/approval/expired` (AGENTS.md rule 3). The actor must be a member
 * of the scope, else one deny event (`engram/approval/membership`). Runs in
 * the write queue; nothing runs on a timer.
 */
export function expireRequests(
  deps: PlaneDeps,
  actor: Actor,
  scope: string,
  at: string,
): Promise<ExpiryReport> {
  checkCall(actor, at, "expireRequests");
  if (!Scope.safeParse(scope).success)
    throw new InvalidCallError(
      `Plane.expireRequests: invalid scope ${JSON.stringify(scope)}; expected person:<id>, role:<id>, team:<id> or org`,
    );
  return inWriteQueue(deps.db, () =>
    deps.db.transaction((): ExpiryReport => {
      const base = { ts: at, actor: actor.id, schema_version: 1 as const, op: "promote" as const };
      if (!actor.memberships.includes(scope)) {
        const event = appendEvent(deps.db, {
          ...base,
          id: deps.newId(),
          item_id: null,
          scope_from: null,
          scope_to: scope,
          decision: "deny",
          reason: `${actor.id} is not a member of ${scope}; only a member may sweep its approval requests`,
          policy_id: APPROVAL_MEMBERSHIP_ID,
        });
        return { decision: "deny", events: [event], expired: [] };
      }
      const due = approvalQueue(deps.policy, allEvents(deps.db), at).filter(
        (r) => r.due && r.scope === scope,
      );
      const events = due.map((r) =>
        appendEvent(deps.db, {
          ...base,
          id: deps.newId(),
          item_id: r.item_id,
          scope_from: r.scope,
          scope_to: r.target,
          decision: "deny",
          reason: expiryReason(r, at),
          policy_id: APPROVAL_EXPIRED_ID,
        }),
      );
      return { decision: "allow", events, expired: due.map((r) => r.item_id) };
    }),
  );
}

/**
 * Plane.refuse: an approver refuses the pending request on the item's
 * current version, with a reason. A held candidate is retired (one `retire`
 * event under `engram/approval/refused`, the approver its actor and their
 * reason in its reason), so it is never promoted; the widening of an active
 * item is refused by one `promote` deny under the same rule, the item left
 * as it is. A refusal the gate does not allow is one deny event: an item the
 * actor cannot reach is refused as an unknown id is
 * (`engram/promote/membership`), no pending request is
 * `engram/approval/no-request`, a request past its expiry is recorded as
 * expired, and a decider the reviewer rule or the route refuses is refused
 * under `engram/promote/reviewer` or `engram/approval/route`. Runs in the
 * write queue. An invalid actor, time, id or an empty reason is refused with
 * InvalidCallError before the log is touched.
 */
export function refuse(
  deps: PlaneDeps,
  actor: Actor,
  itemId: string,
  reason: string,
  at: string,
): Promise<GateResult> {
  checkCall(actor, at, "refuse");
  if (!Id.safeParse(itemId).success)
    throw new InvalidCallError(
      `Plane.refuse: invalid item id ${JSON.stringify(itemId)}; expected a UUIDv7`,
    );
  if (typeof reason !== "string" || reason.trim() === "")
    throw new InvalidCallError("Plane.refuse: a refusal needs a reason");
  return inWriteQueue(deps.db, () =>
    deps.db.transaction((): GateResult => {
      const { db, newId, policy } = deps;
      const base = { ts: at, actor: actor.id, schema_version: 1 as const };
      const one = (event: MemoryEvent): GateResult => ({
        decision: event.decision,
        item: null,
        event,
        events: [event],
      });
      const item = itemById(db, itemId);
      if (!item || !canReach(policy, actor, item, at))
        return one(
          appendEvent(db, {
            ...base,
            id: newId(),
            op: "retire",
            item_id: itemId,
            scope_from: null,
            scope_to: null,
            decision: "deny",
            reason: `item ${itemId} is not one ${actor.id} can access, so it cannot refuse it`,
            policy_id: PROMOTE_MEMBERSHIP_ID,
          }),
        );
      const r = pendingOf(deps, item, at);
      const denied = (policy_id: string, why: string, to: string | null = null) =>
        one(
          appendEvent(db, {
            ...base,
            id: newId(),
            op: policy_id === APPROVAL_EXPIRED_ID ? "promote" : "retire",
            item_id: item.id,
            scope_from: item.scope,
            scope_to: to,
            decision: "deny",
            reason: why,
            policy_id,
          }),
        );
      if (!r)
        return denied(
          APPROVAL_NO_REQUEST_ID,
          `item ${item.id} at version ${item.version} has no pending approval request to refuse`,
        );
      if (r.due) return denied(APPROVAL_EXPIRED_ID, expiryReason(r, at), r.target);
      const problem = deciderProblem(deps, actor, item, r.target);
      if (problem) return denied(problem.policy_id, problem.reason, r.target);
      const why = `${actor.id} refused the request for item ${item.id} at version ${item.version} into ${r.target}: ${reason.trim()}`;
      if (item.status === "candidate")
        return one(
          appendEvent(db, {
            ...base,
            id: newId(),
            op: "retire",
            item_id: item.id,
            scope_from: item.scope,
            scope_to: r.target,
            decision: "allow",
            reason: `${why}; the candidate is retired, not promoted`,
            policy_id: APPROVAL_REFUSED_ID,
          }),
        );
      return one(
        appendEvent(db, {
          ...base,
          id: newId(),
          op: "promote",
          item_id: item.id,
          scope_from: item.scope,
          scope_to: r.target,
          decision: "deny",
          reason: `${why}; the item stays as it is`,
          policy_id: APPROVAL_REFUSED_ID,
        }),
      );
    }),
  );
}
