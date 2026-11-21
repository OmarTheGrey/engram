// Replay validation (card D3; ADR 0011, ADR 0026, ADR 0042 proposed): the
// pure decision that admits a procedural candidate. Pure, like the policy
// evaluators: no clock, no store, no model. The replayer (the runner's
// replay-validate.ts) runs the sessions and the oracle; this file judges what
// they returned.
//
// - The split is made by construction: `heldOutTasks` is the task pool less
//   every task the candidate was induced from, and `replayProblem` refuses a
//   replay that names one of them (leakage between induction and held-out
//   tasks, the card's named risk).
// - A held-out task passes when its mean reward over the seeds with the
//   candidate installed is at or above the threshold. The reward is the
//   task's own check (tau2-bench's database-state hash where the task has
//   one, the fixture's stated outcome otherwise), in 0 to 1.
// - The validation record is k passing tasks of n held-out tasks, with the
//   threshold and how many tasks passed without the candidate beside it, so
//   the promotion event's reason carries the counts; `validationMeets`
//   (policy/promotion.ts) decides it against the policy's replay_k of
//   replay_n, as Plane.promote does.
//
// The threshold is not in the policy: the schema's promotion rule holds
// replay_k and replay_n only, and only card E2.8 changes schema.ts (AGENTS.md
// rule 5). The replay's caller states it (docs/log/2026-11-21-d3-decision-threshold.md).
import { recordText, type ValidationRecord, validationMeets } from "../policy/promotion.ts";
import type { Policy } from "../schema.ts";

/** One held-out task run under one seed, without and with the candidate installed. */
export interface ReplayOutcome {
  /** The held-out task's id. */
  task: string;
  seed: number;
  /** The task's own check of the session without the candidate, 0 to 1. */
  without: number;
  /** The task's own check of the session with the candidate installed, 0 to 1. */
  with: number;
}

/** What a replay of one candidate returned: the input of the admission decision. */
export interface ReplayEvidence {
  /** The tasks the candidate was induced from; none of them may be replayed. */
  induced_from: readonly string[];
  /** A held-out task passes when its mean reward with the candidate is at or above this, in (0, 1]. */
  threshold: number;
  outcomes: readonly ReplayOutcome[];
}

/** One held-out task's score across its seeds. */
export interface TaskScore {
  task: string;
  runs: number;
  /** Mean reward without the candidate. */
  without: number;
  /** Mean reward with the candidate. */
  with: number;
  passed: boolean;
  /** Whether the session without the candidate would have passed: the baseline the reason reports. */
  baseline_passed: boolean;
}

/** The validation record of a replay, with the threshold and the baseline the reason states. */
export type ReplayRecord = Required<ValidationRecord>;

export interface Admission {
  decision: "admit" | "refuse";
  record: ReplayRecord;
  tasks: TaskScore[];
  reason: string;
}

/** The held-out tasks of a pool: every task once, in the pool's order, less the induction tasks. */
export function heldOutTasks(pool: readonly string[], inducedFrom: readonly string[]): string[] {
  const induced = new Set(inducedFrom);
  return [...new Set(pool)].filter((t) => !induced.has(t));
}

const isReward = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1;

/** Why a replay cannot be judged, or null: its split, threshold, rewards or seeds. */
export function replayProblem(e: ReplayEvidence): string | null {
  if (!(typeof e.threshold === "number" && e.threshold > 0 && e.threshold <= 1))
    return `the replay's threshold ${String(e.threshold)} is not in (0, 1]`;
  if (e.outcomes.length === 0) return "the replay ran no held-out task";
  const induced = new Set(e.induced_from);
  const seeds = new Map<string, number[]>();
  for (const o of e.outcomes) {
    if (typeof o.task !== "string" || o.task === "") return "a replayed task has no id";
    if (induced.has(o.task))
      return `task ${o.task} is a task the candidate was induced from; a replay runs only on held-out tasks`;
    if (!Number.isInteger(o.seed))
      return `task ${o.task} ran on seed ${String(o.seed)}, not an integer`;
    if (!isReward(o.without) || !isReward(o.with))
      return `task ${o.task} at seed ${o.seed} has a reward outside 0 to 1`;
    const own = seeds.get(o.task) ?? [];
    if (own.includes(o.seed)) return `task ${o.task} ran twice on seed ${o.seed}`;
    seeds.set(o.task, [...own, o.seed]);
  }
  const lists = [...seeds].map(([t, s]) => [t, [...s].sort((a, b) => a - b).join(", ")] as const);
  const [first, ...rest] = lists;
  const other = rest.find(([, s]) => s !== first?.[1]);
  if (first && other)
    return `task ${first[0]} ran on seeds ${first[1]} and task ${other[0]} on seeds ${other[1]}; every held-out task runs on the same seeds`;
  return null;
}

/** The record and each held-out task's score; throws on a replay with a problem. */
export function scoreReplay(e: ReplayEvidence): { record: ReplayRecord; tasks: TaskScore[] } {
  const problem = replayProblem(e);
  if (problem) throw new Error(`replay validation: ${problem}`);
  const byTask = new Map<string, ReplayOutcome[]>();
  for (const o of e.outcomes) byTask.set(o.task, [...(byTask.get(o.task) ?? []), o]);
  const tasks = [...byTask].map(([task, runs]): TaskScore => {
    const mean = (f: (o: ReplayOutcome) => number) =>
      runs.reduce((s, o) => s + f(o), 0) / runs.length;
    const without = mean((o) => o.without);
    const withIt = mean((o) => o.with);
    return {
      task,
      runs: runs.length,
      without,
      with: withIt,
      passed: withIt >= e.threshold,
      baseline_passed: without >= e.threshold,
    };
  });
  return {
    record: {
      k: tasks.filter((t) => t.passed).length,
      n: tasks.length,
      threshold: e.threshold,
      baseline: tasks.filter((t) => t.baseline_passed).length,
    },
    tasks,
  };
}

/**
 * Admit or refuse a candidate on its replay: admitted when the record meets
 * the policy's replay_k of replay_n (`validationMeets`, the rule
 * Plane.promote applies to the same record). The reason carries the counts.
 */
export function admission(policy: Policy, e: ReplayEvidence): Admission {
  const { record, tasks } = scoreReplay(e);
  const meets = validationMeets(policy, record);
  const { replay_k, replay_n } = policy.promotion.procedural;
  return {
    decision: meets ? "admit" : "refuse",
    record,
    tasks,
    reason: `${recordText(record)} ${meets ? "meets" : "does not meet"} ${replay_k} of ${replay_n}`,
  };
}
