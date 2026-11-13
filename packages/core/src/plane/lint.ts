// Plane.lint (card L1, ADR 0008): runs the deterministic lints the policy's
// `lints.enabled` names over one scope and records every finding as one
// `lint` event. The lints themselves are pure (lint/det.ts); this file reads
// their inputs from the log and appends their findings. A lint event changes
// no item: applyEvent ignores op `lint`, so the projection and its replay are
// the same with or without them. Model-based lints (card L3) are not run here.
//
// MemoryEvent has no lint_id, severity or evidence field (a schema change is
// its own PR, AGENTS.md rule 5), so the event carries them in `reason`, and
// its policy_id is `<policy>/lint/<lint_id>`. A finding's id is its event's id.
import { type Actor, checkCall, InvalidCallError } from "../actor.ts";
import { allEvents, appendEvent, currentItems } from "../events.ts";
import { lintScope } from "../lint/det.ts";
import type { PlaneDeps } from "../plane.ts";
import { readableAt, readableScope } from "../policy/evaluate.ts";
import { type LintFinding, type MemoryEvent, type MemoryItem, Scope } from "../schema.ts";
import { inWriteQueue } from "./queue.ts";

/**
 * The policy id of a lint refused because the actor may not read the scope:
 * not a member of it, or a member whose level the policy's read matrix
 * forbids from reading its level (readableScope, the gate Plane.read applies).
 */
export const LINT_MEMBERSHIP_ID = "engram/lint/membership";

/** What a lint of one scope did (Plane.lint). */
export interface LintReport {
  /** `deny` when the actor may not read the scope; nothing was linted. */
  decision: "allow" | "deny";
  /** Every finding, in lint order then item id; empty when denied or clean. */
  findings: LintFinding[];
  /** Every event the call appended: one `lint` per finding, or the one deny. */
  events: MemoryEvent[];
}

/** The event that last retired each retired item, from the log. */
function retirements(
  events: readonly MemoryEvent[],
): Map<string, { op: string; policy_id: string }> {
  const by = new Map<string, { op: string; policy_id: string }>();
  for (const e of events)
    if ((e.op === "retire" || e.op === "evict") && e.decision === "allow" && e.item_id !== null)
      by.set(e.item_id, { op: e.op, policy_id: e.policy_id });
  return by;
}

/**
 * Plane.lint: lints `scope` at `at` as `actor`, in the write queue so no
 * write interleaves. An actor who may not read the scope, by membership or
 * by the read matrix, is refused with one deny event (op lint, no item,
 * `engram/lint/membership`), so a lint never shows ids, hashes or refs of
 * items Plane.read would not return (invariant 1). An invalid actor, time or scope is
 * refused with InvalidCallError before the log is touched.
 */
export function lint(
  deps: PlaneDeps,
  actor: Actor,
  at: string,
  scope: string,
): Promise<LintReport> {
  checkCall(actor, at, "lint");
  if (!Scope.safeParse(scope).success)
    throw new InvalidCallError(
      `Plane.lint: invalid scope ${JSON.stringify(scope)}; expected person:<id>, role:<id>, team:<id> or org`,
    );
  return inWriteQueue(deps.db, () => run(deps, actor, at, scope));
}

function run(deps: PlaneDeps, actor: Actor, at: string, scope: string): LintReport {
  const { db, newId, policy } = deps;
  const base = {
    ts: at,
    op: "lint" as const,
    actor: actor.id,
    scope_from: null,
    scope_to: scope,
    schema_version: 1 as const,
  };
  if (!readableScope(policy, actor, scope)) {
    const denied = appendEvent(db, {
      ...base,
      id: newId(),
      item_id: null,
      decision: "deny",
      reason: actor.memberships.includes(scope)
        ? `${actor.id} may not read ${scope}: the read matrix does not let a ${actor.level} reader read ${scope.split(":")[0]} scopes; only a member who may read it may lint it`
        : `${actor.id} is not a member of ${scope} and may not read it; only a member who may read it may lint it`,
      policy_id: LINT_MEMBERSHIP_ID,
    });
    return { decision: "deny", findings: [], events: [denied] };
  }
  const items = new Map<string, MemoryItem>(currentItems(db).map((i) => [i.id, i]));
  const found = lintScope(
    {
      policy,
      at,
      items,
      retiredBy: retirements(allEvents(db)),
      canReach: (item) => readableAt(policy, actor, item, at),
    },
    scope,
    policy.lints.enabled,
  );
  const committed = db.transaction(() =>
    found.map((f) => {
      const id = newId();
      const event = appendEvent(db, {
        ...base,
        id,
        item_id: f.item_id,
        decision: "allow",
        reason: `${f.lint_id} (${f.severity}): ${f.message}; evidence: ${f.evidence.join("; ")}`,
        policy_id: `${policy.id}/lint/${f.lint_id}`,
      });
      const finding: LintFinding = { id, ...f, tier: "deterministic", schema_version: 1 };
      return { event, finding };
    }),
  );
  return {
    decision: "allow",
    findings: committed.map((c) => c.finding),
    events: committed.map((c) => c.event),
  };
}
