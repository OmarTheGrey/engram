import { describe, expect, test } from "vitest";
import type { Role, UsageRow } from "../../src/tau2/launcher.ts";
import type { TaskRow } from "../../src/tau2/result.ts";
import { summarize } from "../../src/tau2/summary.ts";

const row = (
  condition: "C1" | "C5",
  task: string,
  reward: number,
  steps: number,
  error: string | null = null,
): TaskRow => ({
  condition,
  seed: 1,
  task,
  preset: condition === "C5" ? "medium" : "none",
  store: condition === "C5" ? "files" : "none",
  termination: error === null ? "user_stop" : "error",
  db_reward: reward,
  db_match: reward === 1,
  tau2_reward: reward === 1 && task === "6" ? 0 : reward,
  evaluation: "all",
  steps,
  memory_writes: 0,
  memory_writes_denied: condition === "C5" ? 1 : 0,
  memory_reads: 0,
  error,
});

const use = (key: string, role: Role, hit: boolean): UsageRow => ({
  key,
  model: `scripted/tau2-${role}`,
  hit,
  input_tokens: 0,
  output_tokens: 0,
  cost_usd: 0,
  condition: "C1",
  seed: 1,
  task: "6",
  role,
});

describe("a tau2 run's summary", () => {
  test("means per condition, tau2's reward beside the database hash, calls per role, the user simulator's share", () => {
    const summary = summarize(
      [row("C1", "6", 1, 8), row("C1", "16", 0, 6, "boom"), row("C5", "19", 1, 9)],
      [
        use("a1", "agent", true),
        use("a2", "agent", false),
        use("u1", "user", true),
        use("u1", "user", true),
        use("j1", "judge", true),
      ],
      (key) => (key.startsWith("a") ? 300 : 100),
    );
    expect(summary.conditions.C1).toEqual({
      tasks: 2,
      failed: 1,
      tau2_reward: 0,
      db_reward: 0.5,
      steps: 7,
      memory_writes_denied: 0,
    });
    expect(summary.conditions.C5?.tau2_reward).toBe(1);
    expect(summary.calls).toEqual({ total: 5, new: 1, cached: 4 });
    expect(summary.roles.user).toEqual({
      calls: 2,
      new: 0,
      cached: 2,
      cassettes: 1,
      cassette_bytes: 100,
    });
    expect(summary.roles.judge.calls).toBe(1);
    expect(summary.roles.agent.cassette_bytes).toBe(600);
    expect(summary.user_cassette_share).toBe(0.125);
  });
});
