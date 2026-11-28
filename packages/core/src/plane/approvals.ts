// The approval queue (card E2.19 of the second absorb plan): a pure
// projection over the log, with no table and no event field of its own
// (docs/log/2026-11-25-ap2-decision-approvals-without-schema.md). A request
// is keyed by its item's id, version and target (review finding F3), so one
// version has at most one request per target, each with its own route and
// expiry.
//
// A request opens at the first of:
//   - a held write: an allowed `write` or `update` whose item lands as a
//     candidate (a scope that requires review, the injection screen's or a
//     content guard's hold, an import); its target is the item's scope;
//   - a `gate` event with decision `ask` that Plane.promote appends when a
//     promotion waits for a reviewer; its target is the event's `scope_to`.
// A later ask on the same version and target joins the open request and
// does not reopen or extend it, and a version and target whose request
// expired or was refused is closed for good: no ask reopens it. It closes at
// the first of:
//   approved  an allowed `promote` of the item into its target (in place, or
//             a new version whose lineage starts at it);
//   expired   a `promote` deny into its target under `engram/approval/expired`:
//             the sweep (expireRequests) or a promotion attempted after it;
//   denied    an approver's refusal (`engram/approval/refused`: a `retire`
//             of a candidate refused in its own scope, or a `promote` deny for
//             a widening), any other allowed retire, evict or erasure of the
//             item, a promotion of it elsewhere, or a rewrite to another
//             version (which, if it is still a candidate, opens the new
//             version's request).
// A drift restore's ask (card D4, Plane.revalidate) opens a `restore`
// request on the retired procedure: each presentation is judged afresh on
// its own replay, so a new restore ask replaces an open restore request, and
// neither its expiry nor its refusal closes the version for a later
// presentation (review finding F4). An approver approves one by presenting
// the replay with `review` (Plane.revalidate).
//
// Routes and expiry are read from the policy the queue is given, the current
// one, for past requests too: events record no policy version (finding F7),
// so a policy change moves the routing and expiry of requests still open.
// Without an approval block the queue is still listed, and approval is ADR
// 0026's review as before; refusing and sweeping are off
// (`engram/approval/off`, finding F2).
// A request past its route's `expires_after` and not yet closed is still
// `pending`, marked `due`: the projection decides nothing, so an expiry is
// only ever what an event records (AGENTS.md rule 3).
//
// Routing is the policy's `approval` block (routeFor, policy/promotion.ts):
// a route narrows ADR 0026's eligible reviewers and never widens them, and
// `owner` is ADR 0049's owner acceptance. No approver may approve or refuse
// their own write: the reviewer rule (reviewerProblem) is asked first. The
// stale-base refusal of obsidian-wiki's staging (MIT, Ar9av/obsidian-wiki at
// 7da8def05ab4, obsidian_wiki/staging.py; ported: the design, rewritten) is
// the version key and the `reviewedVersion` pin: a decision is about the
// version its approver reviewed, and a rewrite closes the request.
import { type Actor, checkCall, InvalidCallError } from "../actor.ts";
import { allEvents, appendEvent, applyEvent, erases } from "../events.ts";
import { itemById } from "../items.ts";
import type { GateResult, PlaneDeps } from "../plane.ts";
import { readableScope } from "../policy/evaluate.ts";
import {
  APPROVAL_EXPIRED_ID,
  APPROVAL_REFUSED_ID,
  APPROVAL_ROUTE_ID,
  APPROVAL_STALE_ID,
  approverNames,
  canReach,
  ownCandidate,
  PROMOTE_MEMBERSHIP_ID,
  PROMOTE_REVIEWER_ID,
  type PromotionEvidence,
  reviewerProblem,
  routeFor,
  routeText,
} from "../policy/promotion.ts";
import { Id, type MemoryEvent, type MemoryItem, type Policy, Scope } from "../schema.ts";
import { addSeconds, compareTimestamps } from "../time.ts";
import { authorsOf, promotionDecision } from "./promote.ts";
import { inWriteQueue } from "./queue.ts";

export { APPROVAL_EXPIRED_ID, APPROVAL_REFUSED_ID, APPROVAL_ROUTE_ID, APPROVAL_STALE_ID };
/** A refusal asked for an item version with no pending request. */
export const APPROVAL_NO_REQUEST_ID = "engram/approval/no-request";
/** A sweep of a scope's requests by an actor who is not a member of it. */
export const APPROVAL_MEMBERSHIP_ID = "engram/approval/membership";
/** A refusal or sweep under a policy with no approval block (finding F2). */
export const APPROVAL_OFF_ID = "engram/approval/off";

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
  /** A drift restore's request on a retired procedure (card D4): it never closes the version. */
  restore: boolean;
  state: RequestState;
  /** Pending and past `expires_at` at the time asked: the next sweep or attempt records the expiry. */
  due: boolean;
  /** The event that closed it, with its rule and actor; null while pending. */
  closed_by: string | null;
  closed_at: string | null;
  closed_under: string | null;
  closer: string | null;
}

function opened(
  policy: Policy,
  e: MemoryEvent,
  item: MemoryItem,
  target: string,
  restore: boolean,
): ApprovalRequest {
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
    restore,
    state: "pending",
    due: false,
    closed_by: null,
    closed_at: null,
    closed_under: null,
    closer: null,
  };
}

/** How `e` closes the open request `r`, or null when it does not. */
function closing(e: MemoryEvent, r: ApprovalRequest): RequestState | null {
  const id = r.item_id;
  if (e.op === "promote" && e.decision === "allow" && e.item) {
    if (e.item_id !== id && e.item.lineage[0] !== id) return null;
    return e.item.scope === r.target ? "approved" : "denied";
  }
  if (e.item_id !== id) return null;
  if (e.op === "promote" && e.decision === "deny") {
    if (e.scope_to !== r.target) return null;
    if (e.policy_id === APPROVAL_EXPIRED_ID) return "expired";
    if (e.policy_id === APPROVAL_REFUSED_ID) return "denied";
    return null;
  }
  const version = r.version;
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
  // Open requests by item id and target.
  const open = new Map<string, ApprovalRequest>();
  // Versions and targets whose request expired or was refused: closed for good.
  const decided = new Set<string>();
  const out: ApprovalRequest[] = [];
  const close = (key: string, r: ApprovalRequest, e: MemoryEvent, state: RequestState) => {
    Object.assign(r, {
      state,
      closed_by: e.id,
      closed_at: e.ts,
      closed_under: e.policy_id,
      closer: e.actor,
    });
    if (!r.restore && (state === "expired" || e.policy_id === APPROVAL_REFUSED_ID))
      decided.add(`${r.item_id}@${r.version}|${r.target}`);
    open.delete(key);
  };
  for (const e of events) {
    for (const [key, r] of open) {
      const state = closing(e, r);
      if (state !== null) close(key, r, e, state);
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
    if (!item) continue;
    const target = held ? item.scope : (e.scope_to ?? item.scope);
    const key = `${id}|${target}`;
    // A restore's ask is a fresh presentation: it replaces an open restore request.
    const restore = asked && item.status === "retired";
    const was = open.get(key);
    if (was && restore && was.restore) close(key, was, e, "denied");
    else if (was) continue;
    if (!restore && decided.has(`${id}@${item.version}|${target}`)) continue;
    const r = opened(policy, e, item, target, restore);
    open.set(key, r);
    out.push(r);
  }
  for (const r of open.values())
    r.due = r.expires_at !== null && compareTimestamps(r.expires_at, at) <= 0;
  return out;
}

/**
 * The closed request of `item`'s current version into `target` at `at`, for
 * the promotion evaluator's evidence (`closedRequest`): expired (recorded, or
 * pending and due) or refused by an approver. Nothing when the policy has no
 * approval block, so a policy without one gathers nothing and decides as
 * before; nothing for a drift restore's request, which never closes the
 * version.
 */
export function closedRequestOf(
  deps: PlaneDeps,
  item: MemoryItem,
  target: string,
  at: string,
): { closedRequest: NonNullable<PromotionEvidence["closedRequest"]> } | Record<string, never> {
  if (deps.policy.approval === undefined) return {};
  const r = approvalQueue(deps.policy, allEvents(deps.db), at).findLast(
    (q) => q.item_id === item.id && q.version === item.version && q.target === target,
  );
  if (!r || r.restore) return {};
  if (r.due || r.state === "expired")
    return {
      closedRequest: {
        state: "expired",
        at: r.expires_at as string,
        by: r.closed_by ?? r.opened_by,
        opened_by: r.opened_by,
      },
    };
  if (r.state === "denied" && r.closed_under === APPROVAL_REFUSED_ID)
    return {
      closedRequest: {
        state: "refused",
        at: r.closed_at as string,
        by: r.closed_by as string,
        opened_by: r.opened_by,
      },
    };
  return {};
}

/** The pending requests on `item`'s current version, one per target. */
function pendingOf(deps: PlaneDeps, item: MemoryItem, at: string): ApprovalRequest[] {
  return approvalQueue(deps.policy, allEvents(deps.db), at).filter(
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
  /**
   * The actor may approve it now: pending, not due, the actor an approver the
   * route names, and the promotion gate would allow their review (for a
   * procedure, whose admission needs its replay, the approver rules only).
   */
  may_decide: boolean;
}

/**
 * Plane.approvals: the queue at `at` as `actor` may see it, every request
 * whose item's scope the actor may read as a member (the read matrix), in
 * the order they opened, each saying whether the actor may approve it now
 * (and, with an approval block, refuse it). Decides nothing and appends no
 * event.
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
    const now = itemById(deps.db, r.item_id);
    const live = r.state === "pending" && !r.due && now?.version === r.version;
    const item = now && r.restore ? ({ ...now, status: "candidate" } as MemoryItem) : now;
    // The gate itself answers (verification note N1): a confirmer, or the
    // owner of a guard-held candidate with a live grant, is not offered a
    // decision promote would refuse. A procedure's admission needs its replay,
    // which the queue does not hold, so for one the decider rules answer.
    const decider = live && deciderProblem(deps, actor, item as MemoryItem, r.target) === null;
    const allowed =
      decider &&
      (item?.class === "procedural" ||
        promotionDecision(deps, actor, item as MemoryItem, r.target, at, {
          review: true,
          reviewedVersion: r.version,
        }).decision === "allow");
    out.push({ ...r, may_decide: allowed });
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

const OFF_REASON =
  "the policy sets no approval block, so requests are neither refused nor expired: approval is ADR 0026's review, as before";

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
      if (deps.policy.approval === undefined) {
        const event = appendEvent(deps.db, {
          ...base,
          id: deps.newId(),
          item_id: null,
          scope_from: null,
          scope_to: scope,
          decision: "deny",
          reason: OFF_REASON,
          policy_id: APPROVAL_OFF_ID,
        });
        return { decision: "deny", events: [event], expired: [] };
      }
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
 * Plane.refuse: an approver refuses a pending request on the item's current
 * version, with a reason: the one into `options.target`, else the one into
 * the item's own scope, else its only pending one. A held candidate refused
 * in its own scope is retired (one `retire` event under
 * `engram/approval/refused`, the approver its actor and their reason in its
 * reason), so it is never promoted; a widening, or a drift restore, is
 * refused by one `promote` deny under the same rule, the item left as it is.
 * Under a policy with no approval block every call is one deny under
 * `engram/approval/off`. A refusal the gate does not allow is one deny event: an item the
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
  options: { reviewedVersion?: number; target?: string } = {},
): Promise<GateResult> {
  checkCall(actor, at, "refuse");
  if (options.target !== undefined && !Scope.safeParse(options.target).success)
    throw new InvalidCallError(
      `Plane.refuse: invalid target ${JSON.stringify(options.target)}; expected person:<id>, role:<id>, team:<id> or org`,
    );
  const pinned = options.reviewedVersion;
  if (pinned !== undefined && !(Number.isInteger(pinned) && pinned > 0))
    throw new InvalidCallError(
      `Plane.refuse: invalid reviewedVersion ${JSON.stringify(pinned)}; expected a positive integer`,
    );
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
      if (policy.approval === undefined)
        return one(
          appendEvent(db, {
            ...base,
            id: newId(),
            op: "promote",
            item_id: itemId,
            scope_from: null,
            scope_to: null,
            decision: "deny",
            reason: OFF_REASON,
            policy_id: APPROVAL_OFF_ID,
          }),
        );
      const held = itemById(db, itemId);
      if (!held || !canReach(policy, actor, held, at))
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
      const denied = (policy_id: string, why: string, to: string | null = null) =>
        one(
          appendEvent(db, {
            ...base,
            id: newId(),
            op: policy_id === APPROVAL_EXPIRED_ID ? "promote" : "retire",
            item_id: held.id,
            scope_from: held.scope,
            scope_to: to,
            decision: "deny",
            reason: why,
            policy_id,
          }),
        );
      // The pin first (finding F8): a rewrite since the review is stale, whatever is pending now.
      if (pinned !== undefined && pinned !== held.version)
        return denied(
          APPROVAL_STALE_ID,
          `${actor.id} reviewed version ${pinned} of item ${held.id}, which is at version ${held.version} now: it changed since it was reviewed, so nothing is refused; review the current version`,
          options.target ?? null,
        );
      const pending = pendingOf(deps, held, at);
      const r =
        options.target !== undefined
          ? pending.find((q) => q.target === options.target)
          : (pending.find((q) => q.target === held.scope) ??
            (pending.length === 1 ? pending[0] : undefined));
      if (!r)
        return denied(
          APPROVAL_NO_REQUEST_ID,
          pending.length > 1 && options.target === undefined
            ? `item ${held.id} at version ${held.version} has pending requests into ${pending.map((q) => q.target).join(", ")}; name the one to refuse`
            : `item ${held.id} at version ${held.version} has no pending approval request${options.target === undefined ? "" : ` into ${options.target}`} to refuse`,
          options.target ?? null,
        );
      if (r.due) return denied(APPROVAL_EXPIRED_ID, expiryReason(r, at), r.target);
      // A restore's request is decided on the procedure as the candidate it was.
      const item = r.restore ? ({ ...held, status: "candidate" } as MemoryItem) : held;
      const problem = deciderProblem(deps, actor, item, r.target);
      if (problem) return denied(problem.policy_id, problem.reason, r.target);
      const why = `${actor.id} refused the request for item ${item.id} at version ${item.version} into ${r.target}: ${reason.trim()}`;
      if (held.status === "candidate" && r.target === held.scope)
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
