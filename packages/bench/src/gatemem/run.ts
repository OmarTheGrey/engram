// One GateMem run from a config: load the data, run the reference agent
// through the harness with every model call cached under its checkpoint
// (AGENTS.md rule 7), score the predictions with the rule-based scorer and,
// when the config names a judge and the caller passes its model, with
// upstream's LLM judge (judge.ts), every judge call cached the same way.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ModelCall } from "@engram/core";
import {
  type CacheStore,
  type CallContext,
  cached,
  memoryCache,
  type UsageRecord,
} from "@engram/model";
import { z } from "zod";
import { ExampleAgent, LongContextAgent, type ModelForItem } from "./agents.ts";
import { runBenchmark } from "./harness.ts";
import {
  type JudgeRow,
  type JudgeSettings,
  type JudgeSummary,
  promoteJudgeMetrics,
  renderJudgePrompt,
  runJudge,
} from "./judge.ts";
import { type Domain, loadDataset } from "./load.ts";
import type { PredictionRow } from "./schema.ts";
import { type Score, type Summary, scorePredictions } from "./score.ts";

export const RunConfig = z.strictObject({
  benchmark: z.literal("gatemem"),
  /** Data root with one directory per domain; relative to the config file. */
  data: z.string(),
  agent: z.enum(["long_context", "example"]),
  /** `provider/model-id`; `scripted/...` answers from `script`. */
  model: z.string(),
  seed: z.number().int(),
  temperature: z.number(),
  max_tokens: z.number().int().positive(),
  max_turns: z.number().int().positive(),
  /** Cache key parts besides the item (ADR 0017). */
  condition: z.string(),
  preset: z.string(),
  store: z.string(),
  /** The scripted model's responses by checkpoint id; relative to the config file. */
  script: z.string().optional(),
  /** File cache (cassettes); relative to the config file. */
  cassettes: z.string().optional(),
  gate_by_action: z.boolean().default(false),
  /**
   * The LLM judge (judge.ts). The paper's is `openai/gpt-4o` at temperature
   * 0 with 4096 output tokens (PAPER_JUDGE); a `scripted/...` judge answers
   * from `script`. Absent, only the rule-based scorer runs.
   */
  judge: z
    .strictObject({
      model: z.string(),
      seed: z.number().int(),
      temperature: z.number(),
      max_tokens: z.number().int().positive(),
      /** The scripted judge's replies by checkpoint (readJudgeScript); relative to the config file. */
      script: z.string().optional(),
      /** File cache of judge calls (cassettes); relative to the config file. */
      cassettes: z.string().optional(),
    })
    .optional(),
});
export type RunConfig = z.infer<typeof RunConfig>;

/** Read a config and resolve its paths against the config file's directory. */
export function readRunConfig(path: string): RunConfig {
  const config = RunConfig.parse(JSON.parse(readFileSync(path, "utf8")));
  const base = dirname(resolve(path));
  const at = (p: string | undefined) => (p === undefined ? undefined : resolve(base, p));
  const judge = config.judge && {
    ...config.judge,
    ...(config.judge.script ? { script: at(config.judge.script) } : {}),
    ...(config.judge.cassettes ? { cassettes: at(config.judge.cassettes) } : {}),
  };
  return {
    ...config,
    data: resolve(base, config.data),
    ...(config.script ? { script: at(config.script) } : {}),
    ...(config.cassettes ? { cassettes: at(config.cassettes) } : {}),
    ...(judge ? { judge } : {}),
  };
}

/** The judge settings a config names, if it names a judge. */
export function judgeSettings(config: RunConfig): JudgeSettings | undefined {
  const j = config.judge;
  return j && { model: j.model, seed: j.seed, temperature: j.temperature, maxTokens: j.max_tokens };
}

/** A scripted model keyed by benchmark item: the response recorded for that checkpoint. */
export function scriptedByItem(responses: Readonly<Record<string, string>>): ModelForItem {
  return (checkpointId) => async (request) => {
    const text = responses[checkpointId];
    if (text === undefined) {
      throw new Error(
        `scripted model has no response for ${checkpointId} (model ${request.model})`,
      );
    }
    return { text, usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
  };
}

export function readScript(path: string): Record<string, string> {
  const parsed = z
    .object({ responses: z.record(z.string(), z.string()) })
    .parse(JSON.parse(readFileSync(path, "utf8")));
  return parsed.responses;
}

export interface RunOptions {
  /** The model per item before caching. */
  model: ModelForItem;
  cache: CacheStore;
  /** The judge model per item before caching, and its cache; the judge runs only with this and `config.judge`. */
  judge?: { model: ModelForItem; cache: CacheStore };
  /** Refuse cache misses; unset means ENGRAM_OFFLINE=1 decides (see `cached`). */
  offline?: boolean;
  domains?: Domain[];
}

export interface RunResult {
  predictions: PredictionRow[];
  scores: Score[];
  summary: Summary;
  usage: UsageRecord[];
  /** When the judge ran: its rows, its summary, that summary promoted as score_predictions.py does, its calls. */
  judge?: {
    rows: JudgeRow[];
    summary: JudgeSummary;
    promoted: Record<string, unknown>;
    usage: UsageRecord[];
  };
}

export async function runGateMem(config: RunConfig, options: RunOptions): Promise<RunResult> {
  const domains = options.domains ?? loadDataset(config.data);
  /** A model per item through the cache, keyed as ADR 0017 says; a judge call differs by model and prompt. */
  const through =
    (model: ModelForItem, cache: CacheStore, ledger: UsageRecord[]): ModelForItem =>
    (checkpointId) => {
      const context: CallContext = {
        item: `gatemem/${checkpointId}`,
        condition: config.condition,
        preset: config.preset,
        store: config.store,
      };
      const inner: ModelCall = model(checkpointId);
      return cached(inner, {
        cache,
        context,
        ...(options.offline === undefined ? {} : { offline: options.offline }),
        onUsage: (u) => ledger.push(u),
      });
    };
  const usage: UsageRecord[] = [];
  const call = through(options.model, options.cache, usage);
  const agent =
    config.agent === "example"
      ? new ExampleAgent()
      : new LongContextAgent({
          model: config.model,
          seed: config.seed,
          temperature: config.temperature,
          maxTokens: config.max_tokens,
          maxTurns: config.max_turns,
          call,
        });
  const predictions = await runBenchmark(agent, domains);
  const checkpoints = domains.flatMap((d) => d.checkpoints);
  const { scores, summary } = scorePredictions(checkpoints, predictions, config.gate_by_action);
  const settings = judgeSettings(config);
  if (!settings || !options.judge) return { predictions, scores, summary, usage };
  const judgeUsage: UsageRecord[] = [];
  const judged = await runJudge(
    checkpoints,
    predictions,
    through(options.judge.model, options.judge.cache, judgeUsage),
    settings,
    config.gate_by_action,
  );
  return {
    predictions,
    scores,
    summary: { ...summary, judge: "run" },
    usage,
    judge: {
      ...judged,
      promoted: promoteJudgeMetrics(summary, judged.summary),
      usage: judgeUsage,
    },
  };
}

/** What `make bench BENCH=gatemem DRY=1` reports: the live run's calls and cache keys, no model called. */
export interface DryRun {
  model: string;
  seed: number;
  judge_model: string;
  episodes: number;
  checkpoints: number;
  by_domain: Record<string, { episodes: number; checkpoints: number }>;
  answer: {
    /** One call per checkpoint. */
    calls: number;
    unique_keys: number;
    /** Code points of the system and user prompts, summed. */
    input_chars: number;
    keys: { checkpoint_id: string; key: string }[];
  };
  judge: {
    /** One attempt per checkpoint when every reply parses, three when none does. */
    calls_min: number;
    calls_max: number;
    /** The judge prompt holds the answer, so its keys exist only once the answers do. */
    keys: "known after the answer run";
    /** Code points of the judge prompts with an empty answer, summed: a floor on what is sent. */
    input_chars_min: number;
  };
}

/**
 * The live run without its model: the reference agent runs over every
 * checkpoint with a stand-in that returns an empty reply and is not a model,
 * so the answer calls' requests, and therefore their cache keys, are exactly
 * those the live run makes (ADR 0017: the key is the item, condition,
 * preset, store, model, seed and prompt hash). Nothing is read from or
 * written to a cassette.
 */
export async function dryRunGateMem(
  config: RunConfig,
  options: { domains?: Domain[]; judgeModel: string },
): Promise<DryRun> {
  const domains = options.domains ?? loadDataset(config.data);
  const sent: { checkpoint_id: string; chars: number }[] = [];
  const standIn: ModelForItem = (checkpointId) => async (request) => {
    const texts = [request.system ?? "", ...request.messages.map((m) => m.content)];
    sent.push({
      checkpoint_id: checkpointId,
      chars: texts.reduce((n, t) => n + [...t].length, 0),
    });
    return { text: "", usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
  };
  const { judge: _judge, ...answerOnly } = config;
  const { usage } = await runGateMem(answerOnly, {
    model: standIn,
    cache: memoryCache(),
    offline: false,
    domains,
  });
  if (usage.length !== sent.length || usage.some((u) => u.hit)) {
    throw new Error("dry run: every answer call must reach the stand-in exactly once");
  }
  const checkpoints = domains.flatMap((d) => d.checkpoints);
  const empty = { action: "", answer: "", answer_structured: {} };
  return {
    model: config.model,
    seed: config.seed,
    judge_model: options.judgeModel,
    episodes: domains.reduce((n, d) => n + d.episodes.length, 0),
    checkpoints: checkpoints.length,
    by_domain: Object.fromEntries(
      domains.map((d) => [
        d.domain,
        { episodes: d.episodes.length, checkpoints: d.checkpoints.length },
      ]),
    ),
    answer: {
      calls: usage.length,
      unique_keys: new Set(usage.map((u) => u.key)).size,
      input_chars: sent.reduce((n, s) => n + s.chars, 0),
      keys: sent.map((s, i) => ({
        checkpoint_id: s.checkpoint_id,
        key: (usage[i] as UsageRecord).key,
      })),
    },
    judge: {
      calls_min: checkpoints.length,
      calls_max: 3 * checkpoints.length,
      keys: "known after the answer run",
      input_chars_min: checkpoints.reduce((n, c) => n + [...renderJudgePrompt(c, empty)].length, 0),
    },
  };
}
