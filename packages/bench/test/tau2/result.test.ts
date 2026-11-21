// Rows from tau2's own output, on synthetic SimulationRun files shaped as
// tau2's evaluator writes them (src/tau2/evaluator/evaluator.py at the pin),
// and the environment tau2 is started in.
import { describe, expect, test } from "vitest";
import {
  DEAD_OPENAI_BASE_URL,
  type DriverRow,
  PYTHON_FLAGS,
  type SimulationRun,
  taskRow,
  tau2Env,
} from "../../src/tau2/result.ts";

const cell = { condition: "C5" as const, seed: 1, preset: "medium", store: "files" };
const driver = (
  task: string,
  simulation: string | null,
  error: string | null = null,
): DriverRow => ({
  task,
  evaluation: "all",
  simulation,
  error,
});
const messages = (n: number) => Array.from({ length: n }, () => ({}));

describe("a task's row from tau2's SimulationRun", () => {
  test("the database matches but COMMUNICATE fails: the hash check is 1 and tau2's reward 0", () => {
    const sim: SimulationRun = {
      termination_reason: "user_stop",
      // tau2's ALL evaluation: reward is the product of DB (1) and COMMUNICATE (0).
      reward_info: { reward: 0, db_check: { db_match: true, db_reward: 1 } },
      messages: messages(12),
    };
    const row = taskRow(cell, driver("18", "x.json"), sim, []);
    expect(row).toMatchObject({
      db_reward: 1,
      db_match: true,
      tau2_reward: 0,
      steps: 12,
      error: null,
    });
  });

  test("a premature termination: tau2 scores 0 with no database check, and so does the row", () => {
    const sim: SimulationRun = {
      termination_reason: "max_steps",
      reward_info: { reward: 0, db_check: null },
      messages: messages(30),
    };
    const row = taskRow(cell, driver("16", "x.json"), sim, []);
    expect(row).toMatchObject({
      termination: "max_steps",
      db_reward: 0,
      db_match: false,
      tau2_reward: 0,
      steps: 30,
    });
  });

  test("a task the driver caught an error on is a row with the error and no reward", () => {
    const row = taskRow(cell, driver("19", null, "NotFoundError: cassette_miss"), null, []);
    expect(row).toMatchObject({
      termination: "error",
      db_reward: 0,
      tau2_reward: 0,
      error: "NotFoundError: cassette_miss",
    });
  });

  test("counts the task's own memory calls and the writes the plane denied", () => {
    const sim: SimulationRun = {
      termination_reason: "user_stop",
      reward_info: { reward: 1, db_check: { db_match: true, db_reward: 1 } },
      messages: messages(8),
    };
    const memory = [
      { task: "6", tool: "memory_write", decision: "deny" },
      { task: "6", tool: "memory_write", decision: "allow" },
      { task: "6", tool: "memory_read", decision: "allow" },
      { task: "19", tool: "memory_write", decision: "allow" },
    ];
    expect(taskRow(cell, driver("6", "x.json"), sim, memory)).toMatchObject({
      memory_writes: 2,
      memory_writes_denied: 1,
      memory_reads: 1,
    });
  });
});

describe("the environment tau2 is started in", () => {
  test("holds no provider key, sends a stray OpenAI call to a dead loopback address, and reads no .env", () => {
    const env = tau2Env({
      PATH: "/bin",
      OPENAI_API_KEY: "sk-real",
      ANTHROPIC_API_KEY: "sk-ant",
      OPENROUTER_API_KEY: "or",
      GEMINI_API_KEY: "g",
      AWS_SECRET_ACCESS_KEY: "a",
      HF_TOKEN: "h",
      OPENAI_BASE_URL: "https://api.openai.com/v1",
    });
    expect(Object.keys(env).filter((k) => /KEY|TOKEN/.test(k))).toEqual([]);
    expect(env.PATH).toBe("/bin");
    expect(env.OPENAI_BASE_URL).toBe(DEAD_OPENAI_BASE_URL);
    expect(env.OPENAI_API_BASE).toBe(DEAD_OPENAI_BASE_URL);
    expect(env.LITELLM_MODE).toBe("PRODUCTION");
    expect(env.LITELLM_LOCAL_MODEL_COST_MAP).toBe("True");
  });

  test("Python runs isolated and in UTF-8 mode", () => {
    expect(PYTHON_FLAGS).toEqual(["-I", "-X", "utf8"]);
  });
});
