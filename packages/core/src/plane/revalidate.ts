// Re-validation on the plane (card D4 of the second absorb plan; ADR 0011 as
// amended 2026-11-28, ADR 0046). The pure rule is distill/drift.ts; this file
// reads the last validation from the log and commits the decision as one
// event, in one slot of the write queue and one transaction, as Plane.retain
// does.
//
// The replay is presented, as for Plane.promote (ADR 0046): the plane calls
// no model (rule 4) and derives the counts from the outcomes itself. Only a
// user-sourced member of the procedure's scope may present one, and it is
// checked against the item exactly as an admission replay is (validate.ts,
// bindingProblem and sizeProblem, under D3's rule ids).
//
// Every call that reaches the log appends exactly one event (rule 3):
//   retire allow   <policy>/drift/<trigger>     the re-validation fell below the floor: retired
//   retire deny    <policy>/drift/<trigger>     it was due and ran, and the procedure is kept
//   promote allow  <policy>/drift/restored      a drift-retired procedure meets the admission rule
//                                               again: the same version is active again
//   promote deny   <policy>/drift/restored      a drift-retired procedure's re-validation does not
//   retire deny    engram/drift/*               refused: off, not due, not user-sourced, not a
//                                               member, not an active or drift-retired procedure
//   retire deny    engram/promote/replay-*      the replay is not this item's (D3-3, D3-1)
// A malformed replay or environment is refused with InvalidCallError before
// the log is touched. Nothing runs on a timer: the surfaces pass `at`.
import { type Actor, checkCall, InvalidCallError } from "../actor.ts";
import {
  DRIFT_MEMBERSHIP_ID,
  DRIFT_NOT_DUE_ID,
  DRIFT_OFF_ID,
  DRIFT_SOURCE_ID,
  DRIFT_STATUS_ID,
  DRIFT_THRESHOLDS_ID,
  type DriftEnvironment,
  driftRuleId,
  driftSettings,
  driftThresholdProblem,
  environmentProblem,
  isDriftRetirement,
  judgeDrift,
  revalidationDue,
} from "../distill/drift.ts";
import {
  bindingProblem,
  type ReplayEvidence,
  replayProblem,
  sizeProblem,
} from "../distill/validate.ts";
import { appendEvent, eventsByItem } from "../events.ts";
import { itemById } from "../items.ts";
import type { LifecycleTrigger } from "../lint.ts";
import type { PlaneDeps } from "../plane.ts";
import { PROMOTE_REPLAY_SPLIT_ID } from "../policy/promotion.ts";
import { Id, type MemoryEvent, type MemoryItem } from "../schema.ts";
import { ERASING_ID, erasingReason, erasureOpen } from "./commit.ts";
import { inWriteQueue } from "./queue.ts";

/** What Plane.revalidate is given beside the item: the re-validation's replay and its environment. */
export interface RevalidateOptions {
  /** The re-validation's replay: D3's shape and rule (distill/validate.ts). */
  replay: ReplayEvidence;
  /**
   * The environment hash the procedure was last validated in and the one the
   * replay ran in. Needed for the `environment_change` trigger; without it
   * only the period can make a re-validation due.
   */
  environment?: DriftEnvironment;
}

/** What one re-validation did. */
export interface RevalidationResult {
  /**
   * retired: fell below the floor; kept: ran and stays active; restored: a
   * drift-retired procedure is active again; refused: nothing was judged.
   */
  outcome: "retired" | "kept" | "restored" | "refused";
  /** The trigger that made it due; null for a refusal before it, or a restore (no trigger needed). */
  trigger: LifecycleTrigger | null;
  /** The one event appended. */
  event: MemoryEvent;
}

/**
 * The time the procedure was last validated: the latest event that left it
 * active (its write, its promotion, a restore) or judged it under a drift
 * rule (kept or retired).
 */
export function lastValidated(deps: PlaneDeps, itemId: string): string | null {
  let at: string | null = null;
  for (const e of eventsByItem(deps.db, itemId)) {
    const activated = e.decision === "allow" && e.item?.status === "active";
    const judged = e.op === "retire" && isDriftRetirement(deps.policy, e.policy_id);
    if (activated || judged) at = e.ts;
  }
  return at;
}

/** The latest allowed retirement of the item, if it was a drift retirement. */
function driftRetired(deps: PlaneDeps, itemId: string): MemoryEvent | undefined {
  const last = eventsByItem(deps.db, itemId)
    .filter((e) => e.decision === "allow" && (e.op === "retire" || e.op === "evict"))
    .at(-1);
  return last !== undefined && isDriftRetirement(deps.policy, last.policy_id) ? last : undefined;
}

/**
 * Plane.revalidate. The call (actor, time, item id, replay shape,
 * environment shape) is checked before the log is touched; the rest runs in
 * one slot of the write queue, in one transaction.
 */
export function revalidate(
  deps: PlaneDeps,
  actor: Actor,
  itemId: string,
  at: string,
  options: RevalidateOptions,
): Promise<RevalidationResult> {
  checkCall(actor, at, "revalidate");
  if (!Id.safeParse(itemId).success)
    throw new InvalidCallError(
      `Plane.revalidate: invalid item id ${JSON.stringify(itemId)}; expected a UUIDv7`,
    );
  if (options?.replay === undefined)
    throw new InvalidCallError("Plane.revalidate: a re-validation presents its replay");
  const problem = replayProblem(options.replay) ?? environmentProblem(options.environment);
  if (problem) throw new InvalidCallError(`Plane.revalidate: ${problem}`);
  return inWriteQueue(deps.db, () =>
    deps.db.transaction(() => decide(deps, actor, itemId, at, options)),
  );
}

function decide(
  deps: PlaneDeps,
  actor: Actor,
  itemId: string,
  at: string,
  options: RevalidateOptions,
): RevalidationResult {
  const { db, newId, policy } = deps;
  const item = itemById(db, itemId);
  const append = (
    e: Pick<MemoryEvent, "op" | "decision" | "reason" | "policy_id"> & {
      item?: MemoryItem;
      scoped?: boolean;
    },
  ) =>
    appendEvent(db, {
      id: newId(),
      ts: at,
      op: e.op,
      item_id: itemId,
      actor: actor.id,
      scope_from: e.scoped === false || !item ? null : item.scope,
      scope_to: e.scoped === false || !item ? null : item.scope,
      decision: e.decision,
      reason: e.reason,
      policy_id: e.policy_id,
      ...(e.item === undefined ? {} : { item: e.item }),
      schema_version: 1,
    });
  const refuse = (policy_id: string, reason: string, scoped = true): RevalidationResult => ({
    outcome: "refused",
    trigger: null,
    event: append({ op: "retire", decision: "deny", policy_id, reason, scoped }),
  });

  // An unknown id and one the actor may not reach look alike (decision D5).
  if (!item || !actor.memberships.includes(item.scope))
    return refuse(
      DRIFT_MEMBERSHIP_ID,
      `item ${itemId} is not one ${actor.id} can access as a member of its scope, so it cannot re-validate it`,
      false,
    );
  const thresholds = driftThresholdProblem(policy);
  if (thresholds !== null) return refuse(DRIFT_THRESHOLDS_ID, thresholds);
  const settings = driftSettings(policy);
  if (settings === null)
    return refuse(
      DRIFT_OFF_ID,
      `policy ${policy.id} sets no procedures.drift, so no admitted procedure is re-validated or retired on drift`,
    );
  if (actor.source !== "user")
    return refuse(
      DRIFT_SOURCE_ID,
      `a re-validation is presented by the person who ran it, user-sourced; ${actor.id} acts with source ${actor.source ?? "none"}`,
    );
  const retiredBy = item.status === "retired" ? driftRetired(deps, item.id) : undefined;
  if (item.class !== "procedural" || (item.status !== "active" && retiredBy === undefined))
    return refuse(
      DRIFT_STATUS_ID,
      item.class !== "procedural"
        ? `item ${item.id} is ${item.class}; only procedures are re-validated`
        : item.status === "candidate"
          ? `item ${item.id} is a candidate; Plane.promote admits it, re-validation keeps or retires an admitted procedure`
          : `item ${item.id} was retired other than by drift; only a drift retirement is undone by re-validation`,
    );
  if (erasureOpen(db, item.scope)) return refuse(ERASING_ID, erasingReason(item.scope));
  const { replay } = options;
  const size = sizeProblem(policy, replay);
  const binding =
    bindingProblem(item, replay, deps.distillTasks) ??
    (size === null ? null : { policy_id: PROMOTE_REPLAY_SPLIT_ID, reason: size });
  if (binding) return refuse(binding.policy_id, binding.reason);

  const env = options.environment;
  const envText =
    env === undefined
      ? "no environment hash presented"
      : env.validated === env.current
        ? `environment unchanged at ${env.current}`
        : `environment ${env.validated} changed to ${env.current}`;

  if (retiredBy !== undefined) {
    // A rollback: the version drift retired, put back as it was, when the
    // re-validation meets the admission rule again and reaches the floor.
    const j = judgeDrift(policy, replay);
    const restores = j.admits && j.decision === "keep" && j.trials >= j.min_trials;
    const policy_id = driftRuleId(policy, "restored");
    const reason = `re-validation of item ${item.id}, retired under ${retiredBy.policy_id} at ${retiredBy.ts}: ${j.text}; ${envText}; ${
      restores
        ? "it meets the admission rule and the floor again, so the retired version is active again"
        : "it does not meet both the admission rule and the floor, so it stays retired"
    }`;
    if (!restores)
      return {
        outcome: "refused",
        trigger: null,
        event: append({ op: "promote", decision: "deny", policy_id, reason }),
      };
    return {
      outcome: "restored",
      trigger: null,
      event: append({
        op: "promote",
        decision: "allow",
        policy_id,
        reason,
        item: { ...item, status: "active" } as MemoryItem,
      }),
    };
  }

  const last = lastValidated(deps, item.id) ?? item.valid_from;
  const trigger = revalidationDue(policy, last, at, env);
  if (trigger === null) {
    const why = [
      settings.environment_change
        ? env === undefined
          ? "no environment hash was presented"
          : env.validated === env.current
            ? "the environment hash is unchanged"
            : ""
        : "environment_change is off",
      settings.period === null
        ? "no period is set"
        : `the period of ${settings.period} seconds since its last validation at ${last} has not passed`,
    ].filter((s) => s !== "");
    return refuse(
      DRIFT_NOT_DUE_ID,
      `no re-validation of item ${item.id} is due: ${why.join(", and ")}`,
    );
  }
  const j = judgeDrift(policy, replay);
  const cause =
    trigger === "environment-changed"
      ? envText
      : `${settings.period} seconds since its last validation at ${last}; ${envText}`;
  const policy_id = driftRuleId(policy, trigger);
  if (j.decision === "retire")
    return {
      outcome: "retired",
      trigger,
      event: append({
        op: "retire",
        decision: "allow",
        policy_id,
        reason: `re-validation on ${trigger} (${cause}): ${j.text}, so the procedure is retired; the retired version stays in the store and the log, and a re-validation that meets the admission rule restores it`,
      }),
    };
  return {
    outcome: "kept",
    trigger,
    event: append({
      op: "retire",
      decision: "deny",
      policy_id,
      reason: `re-validation on ${trigger} (${cause}): ${j.text}, so the procedure is kept`,
    }),
  };
}
