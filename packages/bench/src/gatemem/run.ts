// One GateMem run from a config: load the data, run the reference agent
// through the harness with every model call cached under its checkpoint
// (AGENTS.md rule 7), and score the predictions with the rule-based scorer.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ModelCall } from "@engram/core";
import { type CacheStore, type CallContext, cached, type UsageRecord } from "@engram/runner";
import { z } from "zod";
import { ExampleAgent, LongContextAgent, type ModelForItem } from "./agents.ts";
import { runBenchmark } from "./harness.ts";
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
});
export type RunConfig = z.infer<typeof RunConfig>;

/** Read a config and resolve its paths against the config file's directory. */
export function readRunConfig(path: string): RunConfig {
  const config = RunConfig.parse(JSON.parse(readFileSync(path, "utf8")));
  const base = dirname(resolve(path));
  const at = (p: string | undefined) => (p === undefined ? undefined : resolve(base, p));
  return {
    ...config,
    data: resolve(base, config.data),
    ...(config.script ? { script: at(config.script) } : {}),
    ...(config.cassettes ? { cassettes: at(config.cassettes) } : {}),
  };
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
  /** Refuse cache misses; unset means ENGRAM_OFFLINE=1 decides (see `cached`). */
  offline?: boolean;
  domains?: Domain[];
}

export interface RunResult {
  predictions: PredictionRow[];
  scores: Score[];
  summary: Summary;
  usage: UsageRecord[];
}

export async function runGateMem(config: RunConfig, options: RunOptions): Promise<RunResult> {
  const domains = options.domains ?? loadDataset(config.data);
  const usage: UsageRecord[] = [];
  const call: ModelForItem = (checkpointId) => {
    const context: CallContext = {
      item: `gatemem/${checkpointId}`,
      condition: config.condition,
      preset: config.preset,
      store: config.store,
    };
    const inner: ModelCall = options.model(checkpointId);
    return cached(inner, {
      cache: options.cache,
      context,
      ...(options.offline === undefined ? {} : { offline: options.offline }),
      onUsage: (u) => usage.push(u),
    });
  };
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
  const { scores, summary } = scorePredictions(
    domains.flatMap((d) => d.checkpoints),
    predictions,
    config.gate_by_action,
  );
  return { predictions, scores, summary, usage };
}
