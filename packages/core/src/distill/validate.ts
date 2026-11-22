// Replay validation (card D3; ADR 0011, ADR 0026, ADR 0046 proposed): the
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
// - The replay is bound to its item (card D3 review, D3-3): it names the
//   item's id and the strict content hash of its content, and its induction
//   tasks are the tasks of the item's own distill ref (`distill:<method>:
//   <sessions>`, card D2), mapped by the session index the plane is given.
//   `bindingProblem` says why a replay is not the item's, under its own rule
//   id; the plane records that as a deny event. Its sha256 (`replayDigest`)
//   goes into the record, so the event's reason names the exact replay.
//
// The lead's answers of 2026-11-22 (review findings D3-1 and D3-2,
// docs/tasks/lead-decisions.md item 63): a held-out task passes when the
// candidate's mean reward over the seeds is at least 2/3 (2 of 3 seeds for
// 0 or 1 rewards) and no lower than the mean without it on that task; a
// replay has exactly the policy's replay_n held-out tasks. The threshold is
// fixed here as the registered value, not in the policy (the schema's
// promotion rule holds replay_k and replay_n only, and only card E2.8 changes
// schema.ts); a replay naming another is malformed.
import { createHash } from "node:crypto";
import { strictContentHash } from "../content-hash.ts";
import { canonicalJson } from "../model.ts";
import {
  PROMOTE_REPLAY_ITEM_ID,
  PROMOTE_REPLAY_SPLIT_ID,
  recordText,
  type ValidationRecord,
  validationMeets,
} from "../policy/promotion.ts";
import type { MemoryItem, Policy } from "../schema.ts";
import { parseDistillRef } from "./induce.ts";

/** The registered threshold (lead's answer to D3-2, 2026-11-22): a mean reward of at least 2/3. */
export const REPLAY_THRESHOLD = 2 / 3;

/**
 * The registered seeds (the lead's reading of "3 seeds", 2026-11-22, review
 * finding D3-13): every held-out task runs on exactly seeds 1, 2 and 3, so a
 * caller can neither replay on one seed nor pick its seeds.
 */
export const REPLAY_SEEDS: readonly number[] = [1, 2, 3];

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
  /** The candidate the replay ran: its id. */
  item_id: string;
  /** The strict content hash (content-hash.ts) of the content the replay installed. */
  content_hash: string;
  /** The tasks the candidate was induced from; none of them may be replayed. */
  induced_from: readonly string[];
  /** The pass threshold the replay was judged at: the registered REPLAY_THRESHOLD, 2/3. */
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

/** Why a replay is malformed, or null: its item, content hash, threshold, rewards or seeds. */
export function replayProblem(e: ReplayEvidence): string | null {
  if (typeof e.item_id !== "string" || e.item_id === "") return "the replay names no item";
  if (typeof e.content_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(e.content_hash))
    return "the replay names no content hash (sha256:<64 hex>)";
  if (!Array.isArray(e.induced_from) || e.induced_from.some((t) => typeof t !== "string"))
    return "the replay's induced_from is not a list of task ids";
  if (e.threshold !== REPLAY_THRESHOLD)
    return `the replay's threshold ${String(e.threshold)} is not the registered 2/3`;
  if (e.outcomes.length === 0) return "the replay ran no held-out task";
  const seeds = new Map<string, number[]>();
  for (const o of e.outcomes) {
    if (typeof o.task !== "string" || o.task === "") return "a replayed task has no id";
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
  if (first && first[1] !== REPLAY_SEEDS.join(", "))
    return `the replay ran seeds ${first[1]}, not the registered seeds ${REPLAY_SEEDS.join(", ")}`;
  return null;
}

/**
 * Why the replay's held-out set is not the policy's size, or null (the
 * lead's answer to D3-1): exactly replay_n tasks, so a caller cannot report
 * a subset it chose.
 */
export function sizeProblem(policy: Policy, e: Pick<ReplayEvidence, "outcomes">): string | null {
  const n = new Set(e.outcomes.map((o) => o.task)).size;
  const { replay_n } = policy.promotion.procedural;
  return n === replay_n
    ? null
    : `the replay ran ${n} held-out tasks, and the policy's replay_n is ${replay_n}; a replay runs exactly replay_n`;
}

/** Why the replay's own split leaks, or null: a replayed task among its induction tasks. */
export function splitProblem(e: Pick<ReplayEvidence, "induced_from" | "outcomes">): string | null {
  const induced = new Set(e.induced_from);
  const leaked = e.outcomes.find((o) => induced.has(o.task));
  return leaked
    ? `task ${leaked.task} is a task the candidate was induced from; a replay runs only on held-out tasks`
    : null;
}

/** The replay's sha256, `sha256:<hex>` of its canonical JSON: key order never moves it. */
export function replayDigest(e: ReplayEvidence): string {
  return `sha256:${createHash("sha256").update(canonicalJson(e)).digest("hex")}`;
}

/** A replay the plane refuses for an item, with the rule that refuses it. */
export interface BindingProblem {
  policy_id: string;
  reason: string;
}

const sameSet = (a: readonly string[], b: readonly string[]) => {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((t) => y.has(t));
};

/**
 * Why `e` is not a replay of `item`, or null (card D3 review, D3-3). It must
 * name the item's id and the strict hash of its content
 * (`engram/promote/replay-item`). Its induction tasks must be exactly the
 * tasks of the item's own distill ref, mapped by `tasksOf` (session id to
 * task id, card D1's index), none of them replayed
 * (`engram/promote/replay-split`). An item with no distill ref was induced
 * from no recorded session, so its replay names none. A distill ref the plane
 * holds no index for, or that names a session the index lacks, cannot be
 * checked, and is refused.
 */
export function bindingProblem(
  item: MemoryItem,
  e: ReplayEvidence,
  tasksOf: ReadonlyMap<string, string> | undefined,
): BindingProblem | null {
  const notItem = (why: string) => ({ policy_id: PROMOTE_REPLAY_ITEM_ID, reason: why });
  const split = (why: string) => ({ policy_id: PROMOTE_REPLAY_SPLIT_ID, reason: why });
  if (e.item_id !== item.id)
    return notItem(`the replay was run for item ${e.item_id}, not item ${item.id}`);
  if (e.content_hash !== strictContentHash(item.content))
    return notItem(
      `the replay installed content ${e.content_hash}, and item ${item.id} holds ${strictContentHash(item.content)}`,
    );
  const ref = parseDistillRef(item.provenance.ref);
  let own: string[] = [];
  if (ref !== null) {
    if (tasksOf === undefined)
      return split(
        `item ${item.id} was induced from sessions ${ref.sessions.join(", ")}, and the plane holds no session index to name their tasks`,
      );
    const unknown = ref.sessions.filter((s) => !tasksOf.has(s));
    if (unknown.length > 0)
      return split(
        `item ${item.id} was induced from sessions the plane's session index does not hold: ${unknown.join(", ")}`,
      );
    own = [...new Set(ref.sessions.map((s) => tasksOf.get(s) as string))];
  }
  const leaked = e.outcomes.find((o) => own.includes(o.task));
  if (leaked)
    return split(
      `task ${leaked.task} is one item ${item.id} was induced from (its distill ref); a replay runs only on held-out tasks`,
    );
  if (!sameSet(e.induced_from, own))
    return split(
      `the replay names induction tasks [${[...new Set(e.induced_from)].sort().join(", ")}], and item ${item.id}'s distill ref names [${[...own].sort().join(", ")}]`,
    );
  const own_leak = splitProblem(e);
  return own_leak ? split(own_leak) : null;
}

/** The record and each held-out task's score; throws on a malformed or leaked replay. */
export function scoreReplay(e: ReplayEvidence): { record: ReplayRecord; tasks: TaskScore[] } {
  const problem = replayProblem(e) ?? splitProblem(e);
  if (problem) throw new Error(`replay validation: ${problem}`);
  const byTask = new Map<string, ReplayOutcome[]>();
  for (const o of e.outcomes) byTask.set(o.task, [...(byTask.get(o.task) ?? []), o]);
  const tasks = [...byTask].map(([task, runs]): TaskScore => {
    const mean = (f: (o: ReplayOutcome) => number) =>
      runs.reduce((s, o) => s + f(o), 0) / runs.length;
    const without = mean((o) => o.without);
    const withIt = mean((o) => o.with);
    // Compared as sums over the same runs, so 2 of 3 is exactly 2/3.
    const sum = (f: (o: ReplayOutcome) => number) => runs.reduce((s, o) => s + f(o), 0);
    const reaches = (x: number) => 3 * x >= 2 * runs.length;
    return {
      task,
      runs: runs.length,
      without,
      with: withIt,
      passed: reaches(sum((o) => o.with)) && sum((o) => o.with) >= sum((o) => o.without),
      baseline_passed: reaches(sum((o) => o.without)),
    };
  });
  return {
    record: {
      k: tasks.filter((t) => t.passed).length,
      n: tasks.length,
      threshold: e.threshold,
      baseline: tasks.filter((t) => t.baseline_passed).length,
      replay_sha256: replayDigest(e),
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
  const size = sizeProblem(policy, e);
  const meets = size === null && validationMeets(policy, record);
  const { replay_k, replay_n } = policy.promotion.procedural;
  return {
    decision: meets ? "admit" : "refuse",
    record,
    tasks,
    reason:
      size ??
      `${recordText(record)} ${meets ? "meets" : "does not meet"} ${replay_k} of ${replay_n}`,
  };
}
