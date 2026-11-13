// Card B5, the engineering half: LongMemEval through the runner, replayed from
// the committed cassettes (fixtures/cassettes/b5-longmemeval-plane) on the
// fake store, with zero new model calls.
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  LongMemEvalRunnerConfig,
  longMemEvalContext,
  longMemEvalJudge,
  readLongMemEvalConfig,
  runLongMemEvalConfig,
} from "../src/longmemeval-probe.ts";

const CONFIG = fileURLToPath(
  new URL("../../../research/configs/b5-longmemeval-plane.json", import.meta.url),
);

describe("the LongMemEval runner config", () => {
  test("builds C2 and C5 only", () => {
    const base = { ...readLongMemEvalConfig(CONFIG) };
    expect(() => LongMemEvalRunnerConfig.parse({ ...base, conditions: ["C3"] })).toThrow(
      "only C2 and C5 are built on LongMemEval",
    );
  });

  test("an experiment without a judge uses the paper's; a pipeline without one judges nothing", () => {
    expect(longMemEvalJudge({ kind: "experiment" })).toEqual({
      model: "openai/gpt-4o-2024-08-06",
      temperature: 0,
      max_tokens: 10,
    });
    expect(longMemEvalJudge({ kind: "pipeline" })).toBeUndefined();
  });

  test("C2's cache key states no preset; C5's states the one it enforces", () => {
    const at = { questionId: "q", preset: "medium", store: "fake" } as const;
    expect(longMemEvalContext({ ...at, condition: "C2" }).preset).toBe("none");
    expect(longMemEvalContext({ ...at, condition: "C5" }).preset).toBe("medium");
  });
});

describe("b5-longmemeval-plane on the fake store, offline", () => {
  test("replays every session and judge call from the cassettes, governed and not", async () => {
    const config = { ...readLongMemEvalConfig(CONFIG), store: "fake" as const };
    const result = await runLongMemEvalConfig(config, { offline: true });
    expect(result.calls.new).toBe(0);
    expect(result.rows).toHaveLength(config.items.length * config.conditions.length);
    for (const r of result.rows) {
      expect(r.tool_calls.map((c) => c.name)).toEqual(["memory_read"]);
      expect(r.read).toHaveLength(1);
      expect(r.judge).not.toBeNull();
      // C5's turns cross the plane and its read is a logged decision; C2's go straight to the store.
      if (r.condition === "C5") {
        expect(Object.keys(r.writes)).toEqual(["allow"]);
        expect(r.decisions.map((d) => `${d.op} ${d.decision}`)).toEqual(["read allow"]);
      } else {
        expect(Object.keys(r.writes)).toEqual(["ungoverned"]);
        expect(r.decisions).toEqual([]);
      }
    }
    // The scripted judge says no to "I don't know." and yes otherwise.
    const labels = Object.fromEntries(result.rows.map((r) => [r.question_id, r.judge?.label]));
    expect(labels).toEqual({
      "66f24dbb": true,
      "3d86fd0a": false,
      "0f05491a": true,
      f4f1d8a4_abs: true,
    });
    expect(result.summary.C5?.breakdown.overall).toEqual({ accuracy: 0.75, n: 4 });
  });
});
