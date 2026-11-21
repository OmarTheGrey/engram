// What a tau2 run reads back from tau2, and the environment tau2 is started
// in (card B11, review B11-4, B11-5 and B11-7).
import type { Tau2Condition } from "./config.ts";

export interface TaskRow {
  condition: Tau2Condition;
  seed: number;
  task: string;
  preset: string;
  store: string;
  /** tau2's termination reason, or `error` when the driver caught one for this task. */
  termination: string;
  /** The database hash check alone: 1 when the agent's and the user's databases equal the gold run's. */
  db_reward: number;
  db_match: boolean;
  /** tau2's own reward, H5's metric: the product over the task's reward basis (DB, COMMUNICATE, NL_ASSERTION). */
  tau2_reward: number;
  /** The evaluation tau2 ran (EvaluationType). */
  evaluation: string;
  /** Messages in tau2's trajectory. */
  steps: number;
  memory_writes: number;
  memory_writes_denied: number;
  memory_reads: number;
  /** Why the task did not finish, when the driver caught an error; null otherwise. */
  error: string | null;
}

/** The part of tau2's SimulationRun (src/tau2/data_model/simulation.py) a row reads. */
export interface SimulationRun {
  termination_reason: string;
  reward_info: {
    reward: number;
    db_check: { db_match: boolean; db_reward: number } | null;
  } | null;
  messages: unknown[] | null;
}

/** One line of the driver's tasks.jsonl. */
export interface DriverRow {
  task: string;
  evaluation: string;
  /** The SimulationRun file tau2's result was written to; null when the task raised. */
  simulation: string | null;
  error: string | null;
}

export interface MemoryEntry {
  task: string;
  tool: string;
  decision: string;
}

/**
 * A task's row from tau2's own output: its SimulationRun, as tau2 serialised
 * it, or the error the driver caught. A task tau2 ended prematurely (max
 * steps, too many errors) has reward 0 and no database check, as tau2's
 * evaluator returns for it, so its `db_reward` is 0.
 */
export function taskRow(
  cell: { condition: Tau2Condition; seed: number; preset: string; store: string },
  driver: DriverRow,
  simulation: SimulationRun | null,
  memory: readonly MemoryEntry[],
): TaskRow {
  const own = memory.filter((e) => e.task === driver.task);
  const writes = own.filter((e) => e.tool === "memory_write");
  const db = simulation?.reward_info?.db_check ?? null;
  return {
    ...cell,
    task: driver.task,
    termination: simulation?.termination_reason ?? "error",
    db_reward: db?.db_reward ?? 0,
    db_match: db?.db_match ?? false,
    tau2_reward: simulation?.reward_info?.reward ?? 0,
    evaluation: driver.evaluation,
    steps: simulation?.messages?.length ?? 0,
    memory_writes: writes.length,
    memory_writes_denied: writes.filter((e) => e.decision === "deny").length,
    memory_reads: own.filter((e) => e.tool === "memory_read").length,
    error: simulation === null ? (driver.error ?? "no simulation was written") : null,
  };
}

/**
 * A loopback address nothing listens on (the discard port): where a model
 * call tau2 makes outside its `llm_args`, or a judge with no proxy of its
 * own, is sent, so it fails closed instead of reaching a provider.
 */
export const DEAD_OPENAI_BASE_URL = "http://127.0.0.1:9/v1";

/** A provider key, by name: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, ... */
const KEY = /(_API_KEY|_API_TOKEN|_ACCESS_KEY|_SECRET_KEY|^HF_TOKEN)$/i;

/**
 * The environment tau2's process is started in: the caller's, with every
 * provider key removed (review B11-7), every OpenAI base URL a dead loopback
 * address, LiteLLM told not to fetch its price table from the network nor
 * read a `.env` file (`LITELLM_MODE=PRODUCTION`).
 */
export function tau2Env(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(base)) {
    if (!KEY.test(name)) env[name] = value;
  }
  return {
    ...env,
    OPENAI_BASE_URL: DEAD_OPENAI_BASE_URL,
    OPENAI_API_BASE: DEAD_OPENAI_BASE_URL,
    LITELLM_LOCAL_MODEL_COST_MAP: "True",
    LITELLM_MODE: "PRODUCTION",
  };
}

/** The interpreter flags: isolated (no user site, no PYTHON* variables) and UTF-8 (review B11-8). */
export const PYTHON_FLAGS = ["-I", "-X", "utf8"] as const;
