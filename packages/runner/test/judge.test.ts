// PR #25 review, J1: GateMem's answer judge in the runner, as GateMem's own
// scoring runs it (card B1's port): upstream's prompt and attempts, every
// call cached and keyed like an answer call, the summary promoted as
// score_predictions.py --use_llm_judge promotes it. A scripted judge stands
// in for the paper's GPT-4o (through OpenRouter); the live judge's request is checked
// on a fake model collection that records what it is asked to send.
import type { Api, AssistantMessage, Context, Model } from "@earendil-works/pi-ai";
import { gatemem } from "@engram/bench";
import { UnsupportedRequestError } from "@engram/core";
import { describe, expect, test } from "vitest";
import type { LiveModels } from "../src/answers.ts";
import { configJudge, PAPER_JUDGE_CONFIG, readRunnerConfig } from "../src/config.ts";
import { judgeAnswer, liveJudgeCall } from "../src/judge.ts";
import { type CacheEntry, type CacheStore, memoryCache } from "../src/model/cached.ts";
import { runConfig } from "../src/run.ts";
import { H1_GATEMEM, X1_GATEMEM } from "./paths.ts";

/** A model collection that records each completion it is asked for and answers with `text`. */
function recordingModels(api: string, text: string) {
  const asked: { context: Context; options: Record<string, unknown> }[] = [];
  const model = { id: "openai/gpt-4o", provider: "openrouter", api } as unknown as Model<Api>;
  const models: LiveModels = {
    getModel: (provider, id) =>
      provider === "openrouter" && id === "openai/gpt-4o" ? model : undefined,
    async completeSimple(_model, context, options) {
      asked.push({ context, options: { ...(options as Record<string, unknown>) } });
      return {
        role: "assistant",
        content: [{ type: "text", text }],
        api,
        provider: "openai",
        model: "gpt-4o",
        usage: {
          input: 3,
          output: 2,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 5,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.001 },
        },
        stopReason: "stop",
        timestamp: 0,
      } as AssistantMessage;
    },
  };
  return { models, asked };
}

const VERDICT =
  '{"action_ok": true, "utility_ok": null, "privacy_leak": false, "deletion_leak": null, "notes": "ok"}';

function recordingCache(): CacheStore & { entries: CacheEntry[] } {
  const entries: CacheEntry[] = [];
  return {
    entries,
    get: (key) => entries.find((e) => e.key === key),
    set: (entry) => {
      entries.push(entry);
    },
  };
}

describe("the answer judge (J1)", () => {
  test("an experiment config without a judge gets the paper's, through OpenRouter's seeded API; H1's names it; a pipeline config may name none", () => {
    expect(PAPER_JUDGE_CONFIG).toEqual({
      model: "openrouter/openai/gpt-4o",
      temperature: 0,
      max_tokens: 4096,
    });
    expect(configJudge({ kind: "experiment" })).toEqual(PAPER_JUDGE_CONFIG);
    expect(configJudge({ kind: "pipeline" })).toBeUndefined();
    expect(configJudge(readRunnerConfig(H1_GATEMEM))).toEqual(PAPER_JUDGE_CONFIG);
  });

  test("the live judge sends a seeded chat-completions call, upstream's schema as response_format, at temperature 0 (R4)", async () => {
    const { models, asked } = recordingModels("openai-completions", VERDICT);
    const call = liveJudgeCall(models);
    const settings = {
      model: "openrouter/openai/gpt-4o",
      seed: 7,
      temperature: 0,
      maxTokens: 4096,
    };
    const reply = await call(gatemem.judgeRequest("judge this", 1, settings));
    expect(reply.text).toBe(VERDICT);
    expect(asked).toHaveLength(1);
    expect(asked[0]?.context.messages).toEqual([
      { role: "user", content: "judge this", timestamp: 0 },
    ]);
    expect(asked[0]?.options).toEqual({
      temperature: 0,
      maxTokens: 4096,
      samplingParams: {
        seed: 7,
        response_format: {
          type: "json_schema",
          json_schema: { name: "benchmark_judge", strict: true, schema: gatemem.JUDGE_JSON_SCHEMA },
        },
      },
    });
    // The plain third attempt sends no schema, and still the seed.
    await call(gatemem.judgeRequest("judge this", 3, settings));
    expect(asked[1]?.options).toEqual({
      temperature: 0,
      maxTokens: 4096,
      samplingParams: { seed: 7 },
    });
  });

  test("a judge on an API that takes no seed is refused before it is called (ADR 0017, R7-7)", async () => {
    const { models, asked } = recordingModels("openai-responses", VERDICT);
    for (const attempt of [1, 3] as const) {
      await expect(
        liveJudgeCall(models)(
          gatemem.judgeRequest("judge this", attempt, {
            model: "openrouter/openai/gpt-4o",
            seed: 1,
            temperature: 0,
            maxTokens: 4096,
          }),
        ),
      ).rejects.toThrow(UnsupportedRequestError);
    }
    expect(asked).toEqual([]);
  });

  test("action gating is off, as upstream's gate_by_action defaults to false: a wrong action leaves the judge's leak verdict alone", async () => {
    const config = readRunnerConfig(X1_GATEMEM);
    const domain = gatemem
      .loadDataset(config.data)
      .find((d) =>
        d.checkpoints.some((c) => c.checkpoint_id === config.items[0]),
      ) as gatemem.Domain;
    const checkpoint = domain.checkpoints.find(
      (c) => c.checkpoint_id === config.items[0],
    ) as gatemem.Checkpoint;
    expect(checkpoint.query_type).toBe("privacy");
    // A wrong action (the checkpoint expects answer_redacted); the scripted judge says no leak.
    const row = await judgeAnswer({
      judge: config.judge as NonNullable<typeof config.judge>,
      checkpoint,
      output: { action: "answer", answer: "x", answer_structured: {} },
      seed: 1,
      context: {
        item: `gatemem/${checkpoint.checkpoint_id}`,
        condition: "C2",
        preset: "none",
        store: "fake",
      },
      cache: memoryCache(),
      offline: false,
    });
    expect(row.judge.action_ok).toBe(false);
    expect(row.judge.privacy_leak).toBe(false);
    expect(row.judge).not.toHaveProperty("gated_by_action");
  });

  test("each session's answer is judged, every judge call cached under the session's item, condition, preset and store; a re-run makes none", async () => {
    const config = {
      ...readRunnerConfig(X1_GATEMEM),
      conditions: ["C2" as const, "C5" as const],
      seeds: [1],
    };
    const cache = recordingCache();
    const first = await runConfig(config, { cache, offline: false });
    expect(first.rows.every((r) => r.judge?.judge.parse_ok === true)).toBe(true);
    const judgeCalls = cache.entries.filter((e) => e.request.model === config.judge?.model);
    expect(judgeCalls).toHaveLength(first.rows.length);
    expect(judgeCalls.map((e) => e.context.condition).sort()).toEqual(["C2", "C2", "C5", "C5"]);
    expect(judgeCalls.every((e) => e.request.responseSchema?.name === "benchmark_judge")).toBe(
      true,
    );
    expect(first.judge?.C5).toMatchObject({ action_accuracy: 1 });
    expect(first.judge?.C5).toHaveProperty("llm_judge.judge_privacy_leakage_rate");
    const again = await runConfig(config, { cache, offline: true });
    expect(again.calls.new).toBe(0);
    expect(again.rows).toEqual(first.rows);
  }, 120_000);

  test("without a judge a pipeline config's rows carry no verdict and its summary no judge", async () => {
    const { judge: _judge, ...noJudge } = readRunnerConfig(X1_GATEMEM);
    const result = await runConfig(
      { ...noJudge, conditions: ["C2"], seeds: [1] },
      { cache: memoryCache(), offline: false },
    );
    expect(result.rows.every((r) => r.judge === undefined)).toBe(true);
    expect(result.judge).toBeUndefined();
  }, 60_000);
});
