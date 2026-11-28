// Drift (card D4 of the second absorb plan; ADR 0011, ADR XXXX
// proposed, ADR 0046): when an admitted procedure is re-validated, and
// whether the re-validation retires it. Pure, like validate.ts: no clock, no
// store, no model. The replayer (the runner's replay-validate.ts) runs the
// sessions; the plane (plane/revalidate.ts) gathers the last validation from
// the log and commits the decision as one event.
//
// - When (`procedures.drift`): `environment_change: "on"` re-validates when
//   the environment hash the procedure was last validated in differs from
//   the current one; `period` re-validates once that many seconds have passed
//   since the last validation. Absent is off: no re-validation is ever due,
//   and the plane refuses one.
// - The replay is D3's, unchanged: replay_n held-out tasks drawn from the
//   item's split, seeds 1 to 3, both arms per task and seed, the strict
//   content hash and the distill ref's induction tasks (validate.ts checks
//   them all). Its D3 record (k of n at 2/3, no worse than without) is
//   reported in every reason.
// - Whether it retires (ADR XXXX, proposed): the success rate
//   of the re-validation, the mean reward with the procedure over every
//   task and seed it ran, against the policy's `lints.thresholds`
//   `replay-drift.success-floor`, once it ran at least
//   `replay-drift.min-trials` trials. Below the floor retires; at or above
//   it, or on fewer trials, keeps. The rate is the re-validation's own, not
//   smoothed across re-validations: the log keeps no per-trial history, and
//   a stored rate on the item is a schema change (rule 5).
// - Restoring (SKILL.nb's rollback): a procedure drift retired is kept in the
//   store and the log (ADR 0010). A later re-validation whose rate reaches
//   the floor goes to the promotion gate with its replay, as the candidate
//   it was (plane/promote.ts restoreRetired): the gate's replay rule
//   (replay_k of replay_n), expiry, write rule, duplicate and budget checks
//   decide whether the version comes back, active, version plus one.
//
// Ideas only, no code taken (ADR 0037): SkillGuard's drift re-tests
// (arXiv 2605.10990), Library Drift's retirement after a minimum number of
// trials (arXiv 2605.19576), and SKILL.nb's rollback of retired skills
// (arXiv 2606.08049).
import type { LifecycleTrigger } from "../lint.ts";
import { validationMeets } from "../policy/promotion.ts";
import type { Policy } from "../schema.ts";
import { addSeconds, compareTimestamps } from "../time.ts";
import { type ReplayEvidence, type ReplayRecord, scoreReplay, sizeProblem } from "./validate.ts";

/** Re-validation was asked for under a policy whose `procedures.drift` is absent. */
export const DRIFT_OFF_ID = "engram/drift/off";
/** No trigger is due: the environment is the same and the period has not passed. */
export const DRIFT_NOT_DUE_ID = "engram/drift/not-due";
/** A re-validation presented by an actor that is not user-sourced (ADR 0046, point 4). */
export const DRIFT_SOURCE_ID = "engram/drift/validation-source";
/** The actor is not a member of the procedure's scope, or cannot access the item (opaque). */
export const DRIFT_MEMBERSHIP_ID = "engram/drift/membership";
/** Nothing to re-validate: not procedural, a candidate, or retired other than by drift. */
export const DRIFT_STATUS_ID = "engram/drift/status";
/** The policy sets `procedures.drift` without the two thresholds the retirement rule reads. */
export const DRIFT_THRESHOLDS_ID = "engram/drift/thresholds";

/** The rule a re-validation is decided under: its trigger's, or `restored` for a rollback. */
export function driftRuleId(policy: Policy, rule: LifecycleTrigger | "restored"): string {
  return `${policy.id}/drift/${rule}`;
}

/**
 * Whether `policyId` is a drift trigger's rule, under any policy id: a
 * procedure drift retired under a policy since renamed or versioned is still
 * a drift retirement (review of card D4, finding 5), as retiredContent
 * matches `/promotion/superseded` by its suffix.
 */
export function isDriftRetirement(policyId: string): boolean {
  return /\/drift\/(replay-drift|environment-changed)$/.test(policyId);
}

/** What `procedures.drift` and the two thresholds set, or null when drift is off. */
export interface DriftSettings {
  environment_change: boolean;
  /** Seconds after the last validation; null is never. */
  period: number | null;
  floor: number;
  min_trials: number;
}

/**
 * Why `policy` cannot run drift, or null: it sets `procedures.drift` and
 * lacks `replay-drift.success-floor` in [0, 1] or `replay-drift.min-trials`, a
 * positive integer. Every registered preset sets both; a policy without
 * `procedures.drift` is never judged.
 */
export function driftThresholdProblem(policy: Policy): string | null {
  if (policy.procedures?.drift === undefined) return null;
  const t = policy.lints.thresholds;
  const floor = t["replay-drift.success-floor"];
  const trials = t["replay-drift.min-trials"];
  if (floor === undefined || !(floor >= 0 && floor <= 1))
    return "procedures.drift needs lints.thresholds replay-drift.success-floor, a success rate in [0, 1] (ADR 0011)";
  if (trials === undefined || !Number.isInteger(trials) || trials < 1)
    return "procedures.drift needs lints.thresholds replay-drift.min-trials, a positive whole number of trials (ADR 0011)";
  return null;
}

/** The policy's drift settings, or null when `procedures.drift` is absent or its thresholds are not set. */
export function driftSettings(policy: Policy): DriftSettings | null {
  const drift = policy.procedures?.drift;
  if (drift === undefined || driftThresholdProblem(policy) !== null) return null;
  const t = policy.lints.thresholds;
  return {
    environment_change: drift.environment_change === "on",
    period: drift.period ?? null,
    floor: t["replay-drift.success-floor"] as number,
    min_trials: t["replay-drift.min-trials"] as number,
  };
}

/** The environment hashes a re-validation is judged against: at the last validation, and now. */
export interface DriftEnvironment {
  /** The environment hash the procedure was last validated in, `sha256:<hex>`. */
  validated: string;
  /** The environment hash the re-validation ran in, `sha256:<hex>`. */
  current: string;
}

const isHash = (h: unknown) => typeof h === "string" && /^sha256:[0-9a-f]{64}$/.test(h);

/** Why a presented environment is malformed, or null. */
export function environmentProblem(env: DriftEnvironment | undefined): string | null {
  if (env === undefined) return null;
  if (!isHash(env.validated) || !isHash(env.current))
    return "the re-validation's environment hashes are not sha256:<64 hex>";
  return null;
}

/**
 * The trigger that makes a re-validation due at `at`, or null. A changed
 * environment comes first (the more specific cause); then the period, due
 * once `period` seconds have passed since `lastValidated`, inclusive.
 */
export function revalidationDue(
  policy: Policy,
  lastValidated: string,
  at: string,
  environment?: DriftEnvironment,
): LifecycleTrigger | null {
  const s = driftSettings(policy);
  if (s === null) return null;
  if (
    s.environment_change &&
    environment !== undefined &&
    environment.validated !== environment.current
  )
    return "environment-changed";
  if (s.period !== null) {
    const due = addSeconds(lastValidated, s.period);
    if (due !== null && compareTimestamps(at, due) >= 0) return "replay-drift";
  }
  return null;
}

/** What one re-validation found, and what it decides. */
export interface DriftJudgement {
  /** Below the floor after enough trials: retire. Otherwise keep. */
  decision: "retire" | "keep";
  /** Runs with the procedure installed: every task and seed of the replay. */
  trials: number;
  /** The rewards with the procedure, summed. */
  successes: number;
  /** successes / trials. */
  rate: number;
  floor: number;
  min_trials: number;
  /** D3's record of the same replay (k of n at 2/3, no worse than without). */
  record: ReplayRecord;
  /** Whether that record meets the admission rule (replay_k of replay_n, exactly replay_n tasks). */
  admits: boolean;
  /** The counts, as the event's reason carries them. */
  text: string;
}

const fixed = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(3));

/**
 * Judges a re-validation under `policy` (ADR XXXX, proposed).
 * Throws on a malformed or leaked replay, as scoreReplay does, and when the
 * policy has no drift settings.
 */
export function judgeDrift(policy: Policy, replay: ReplayEvidence): DriftJudgement {
  const s = driftSettings(policy);
  if (s === null)
    throw new Error(
      `drift: ${driftThresholdProblem(policy) ?? `policy ${policy.id} sets no procedures.drift`}`,
    );
  const { record } = scoreReplay(replay);
  const trials = replay.outcomes.length;
  const successes = replay.outcomes.reduce((n, o) => n + o.with, 0);
  const rate = successes / trials;
  // Compared as products, so a floor of 0.7 over 10 trials is exactly 7.
  const below = trials >= s.min_trials && successes < s.floor * trials;
  const admits = sizeProblem(policy, replay) === null && validationMeets(policy, record);
  const { replay_k, replay_n } = policy.promotion.procedural;
  const rateText = `a success rate of ${fixed(rate)} (${fixed(successes)} of ${trials} trials with the procedure)`;
  const ruleText =
    trials < s.min_trials
      ? `fewer than the ${s.min_trials} trials replay-drift.min-trials asks for, so it is kept`
      : `${below ? "below" : "at or above"} the success floor ${fixed(s.floor)} after at least ${s.min_trials} trials`;
  return {
    decision: below ? "retire" : "keep",
    trials,
    successes,
    rate,
    floor: s.floor,
    min_trials: s.min_trials,
    record,
    admits,
    text: `${rateText}, ${ruleText}; its admission record is ${record.k} of ${record.n} held-out tasks (${admits ? "meets" : "does not meet"} ${replay_k} of ${replay_n}); replay ${record.replay_sha256}`,
  };
}
