// The scopes an actor can see (Plane.listScopes, card E8.14): what a
// framework adapter needs to list its namespaces (LangGraph's
// ListNamespacesOp, research note docs/research/absorb/12-frameworks.md,
// AB-FWK-1), decided by Plane.read's gate. A scope is listed when the actor
// may read it by membership (it is a member and the read matrix lets its
// level read that scope's level, readableScope), or when a read now would
// admit an item in it through a live grant (evaluateRead admits it, by
// check `grant`): such an item and its scope are what a read returns anyway.
// A member scope the matrix keeps from the actor's level is not listed, nor
// is the scope of an item a grant names the actor on but the read filter
// would not admit (not active, past its ttl, outside its validity window, an
// expired grant or one for another class), so the list reveals nothing a
// read would not (decision D5).
//
// The decision is one read event (AGENTS.md rule 3): no item, no scope, no
// item ids, under the actor's read rule, its reason starting with
// SCOPE_LIST_PREFIX and counting what was listed and what the matrix kept
// back. Like a read it is not in the write queue; it runs in one transaction
// under the log's lock, its access (status, ttl, grants) judged at the log's
// head when that is later than the time asked for (accessTime, card RV5) and
// validity windows at the time asked for, as Plane.read judges them.
import { type Actor, checkCall } from "../actor.ts";
import { appendEvent, currentItems } from "../events.ts";
import type { PlaneDeps } from "../plane.ts";
import { evaluateRead, readableScope, readRuleId } from "../policy/evaluate.ts";
import { type MemoryEvent, SCHEMA_VERSION } from "../schema.ts";
import { accessTime } from "./read.ts";

/** How the actor sees a listed scope. */
export type ScopeAccess = "membership" | "grant";

/** One scope the actor can see. */
export interface VisibleScope {
  scope: string;
  /**
   * `membership`: a member scope the read matrix lets the actor's level read.
   * `grant`: not that, but a read now admits an item in it through a live grant.
   */
  via: ScopeAccess;
}

/** What Plane.listScopes returns: the scopes in code-point order, and the decision's event. */
export interface ScopeList {
  scopes: VisibleScope[];
  event: MemoryEvent;
}

/** How the reason of a scope listing's read event begins. */
export const SCOPE_LIST_PREFIX = "scope list: ";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The scope list's reason: what was listed, and the member scopes the matrix kept back. */
export function formatScopeListReason(
  level: string,
  members: number,
  granted: number,
  kept: number,
): string {
  return (
    `${SCOPE_LIST_PREFIX}${plural(members, "readable member scope", "readable member scopes")}, ` +
    `${plural(granted, "scope", "scopes")} reached only through a live grant; ` +
    `${plural(kept, "member scope", "member scopes")} the read matrix does not let ${level} read`
  );
}

export async function listScopes(deps: PlaneDeps, actor: Actor, requested: string) {
  checkCall(actor, requested, "listScopes");
  const { db, policy, newId } = deps;
  return db.transaction((): ScopeList => {
    const at = accessTime(db, requested);
    const memberships = [...new Set(actor.memberships)];
    const readable = memberships.filter((s) => readableScope(policy, actor, s));
    const granted = new Set<string>();
    for (const item of currentItems(db)) {
      if (readable.includes(item.scope)) continue;
      // As a read with no `valid_at` judges it: access at `at`, validity at the time asked for.
      const decision = evaluateRead(policy, actor, item, at, requested);
      if (decision.admitted && decision.check === "grant") granted.add(item.scope);
    }
    const scopes: VisibleScope[] = [
      ...readable.map((scope) => ({ scope, via: "membership" as const })),
      ...[...granted].map((scope) => ({ scope, via: "grant" as const })),
    ].sort((a, b) => (a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : 0));
    const event = appendEvent(db, {
      id: newId(),
      ts: at,
      op: "read",
      item_id: null,
      actor: actor.id,
      scope_from: null,
      scope_to: null,
      decision: "allow",
      reason: formatScopeListReason(
        actor.level,
        readable.length,
        granted.size,
        memberships.length - readable.length,
      ),
      policy_id: readRuleId(policy, actor),
      item_ids: [],
      schema_version: SCHEMA_VERSION,
    });
    return { scopes, event };
  });
}
