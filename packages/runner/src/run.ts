// The SDK runner (card RN1, ADR 0001 "Runner"): a plain serial queue over
// (item, condition, seed), each one a fresh pi SDK session with an in-memory
// session manager. Pi Durable is card RN2, behind ENGRAM_RUNNER=durable.
//
// Results are deterministic: rows are in config order, ids come from a
// counter, times from the benchmark, and nothing records a wall-clock time.
// What the cache did is not a result: results.jsonl and summary.json are the
// same whether a run recorded its calls or replayed them, and the call counts
// and the usage ledger go to usage.json (finding R7-10).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import { gatemem } from "@engram/bench";
import { loadPreset } from "@engram/core";
import type { Condition, RunnerConfig } from "./config.ts";
import { type ProbeResult, readProbeScript, runProbe } from "./gatemem-probe.ts";
import { type CacheStore, fileCache, type UsageRecord } from "./model/cached.ts";
import { type AnswerSource, runtimeAnswers, scriptedAnswers } from "./model/cassette.ts";
import type { CompletesSimple } from "./model/pi.ts";

/** Answers for a live (not scripted) model: a model runtime that resolves `provider/model-id`. */
export interface LiveModels extends CompletesSimple {
  getModel(provider: string, id: string): Model<Api> | undefined;
}

export interface RunnerOptions {
  /** Defaults to the config's cassette directory. */
  cache?: CacheStore;
  /** Refuse misses; unset means ENGRAM_OFFLINE=1 decides. */
  offline?: boolean;
  /** Where misses of a non-scripted model go. Without it such a miss is an error. */
  live?: LiveModels;
}

export interface RunnerResult {
  config: string;
  rows: ProbeResult[];
  /** Per condition, the rule-based summary of its rows (card B1's aggregate). */
  summary: Record<string, ReturnType<typeof gatemem.aggregate>>;
  /** Model calls answered by the answer source (new) and from the cache; written to usage.json only. */
  calls: { new: number; cached: number };
  /** The cost ledger, one record per call (ADR 0017); written to usage.json only. */
  usage: UsageRecord[];
}

function findDomain(domains: readonly gatemem.Domain[], checkpointId: string): gatemem.Domain {
  const domain = domains.find((d) => d.checkpoints.some((c) => c.checkpoint_id === checkpointId));
  if (!domain) throw new Error(`no GateMem checkpoint ${checkpointId} in the data`);
  return domain;
}

/** The answer source for a session's misses, chosen by the config's model. */
function answersFor(
  config: RunnerConfig,
  item: string,
  options: RunnerOptions,
): () => AnswerSource {
  const [provider = "", ...rest] = config.model.split("/");
  const id = rest.join("/");
  if (provider === "scripted") {
    const script = readProbeScript(config.script as string);
    const steps = script.steps[item];
    return () => {
      if (!steps) {
        return async () => {
          throw new Error(`the script has no steps for ${item}`);
        };
      }
      return scriptedAnswers(steps, { provider, model: id });
    };
  }
  return () => {
    const live = options.live;
    const model = live?.getModel(provider, id);
    if (!live || !model) {
      return async () => {
        throw new Error(`no live model ${config.model} to answer a cache miss`);
      };
    }
    return runtimeAnswers(live, model);
  };
}

export async function runConfig(
  config: RunnerConfig,
  options: RunnerOptions = {},
): Promise<RunnerResult> {
  const domains = gatemem.loadDataset(config.data);
  const policy = loadPreset(config.preset);
  const cache = options.cache ?? fileCache(config.cassettes);
  const usage: UsageRecord[] = [];
  const rows: ProbeResult[] = [];
  for (const item of config.items) {
    const domain = findDomain(domains, item);
    for (const condition of config.conditions) {
      for (const seed of config.seeds) {
        rows.push(
          await runProbe({
            domain,
            checkpointId: item,
            condition,
            seed,
            model: config.model,
            preset: config.preset,
            policy,
            store: config.store,
            cache,
            answers: answersFor(config, item, options),
            ...(options.offline === undefined ? {} : { offline: options.offline }),
            onUsage: (u) => usage.push(u),
          }),
        );
      }
    }
  }
  const summary: RunnerResult["summary"] = {};
  for (const condition of config.conditions) {
    summary[condition] = gatemem.aggregate(
      rows.filter((r) => r.condition === (condition as Condition)).map((r) => r.score),
    );
  }
  return {
    config: config.name,
    rows,
    summary,
    calls: {
      new: usage.filter((u) => !u.hit).length,
      cached: usage.filter((u) => u.hit).length,
    },
    usage,
  };
}

/**
 * results.jsonl (one row per item, condition and seed) and summary.json,
 * byte-stable between a recording run and a replay; usage.json, the call
 * counts and the cost ledger, which differ between them.
 */
export function writeRunnerResult(result: RunnerResult, out: string): void {
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, "results.jsonl"),
    result.rows.map((r) => `${JSON.stringify(r)}\n`).join(""),
  );
  const { config, summary, calls, usage } = result;
  writeFileSync(join(out, "summary.json"), `${JSON.stringify({ config, summary }, null, 2)}\n`);
  writeFileSync(join(out, "usage.json"), `${JSON.stringify({ config, calls, usage }, null, 2)}\n`);
}
