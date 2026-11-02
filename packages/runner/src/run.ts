// The SDK runner (card RN1, ADR 0001 "Runner"): a plain serial queue over
// (item, store, condition, seed), each one a fresh pi SDK session with an
// in-memory session manager. Pi Durable is card RN2, behind
// ENGRAM_RUNNER=durable.
//
// Results are deterministic: rows are in config order, ids come from a
// counter, times from the benchmark, and nothing records a wall-clock time.
// What the cache did is not a result: results.jsonl and summary.json are the
// same whether a run recorded its calls or replayed them, and the call counts
// and the usage ledger go to usage.json (finding R7-10).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gatemem } from "@engram/bench";
import { loadPreset } from "@engram/core";
import { answersFor, type LiveModels } from "./answers.ts";
import { configCells, configItems, configStores, type RunnerConfig } from "./config.ts";
import { type ProbeResult, runProbe } from "./gatemem-probe.ts";
import { type CacheStore, fileCache, type UsageRecord } from "./model/cached.ts";

export type { LiveModels } from "./answers.ts";

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

/** Every checkpoint id of the data, domain by domain in load order, each domain in file order. */
export const gatememItems = (domains: readonly gatemem.Domain[]): string[] =>
  domains.flatMap((d) => d.checkpoints.map((c) => c.checkpoint_id));

export async function runConfig(
  config: RunnerConfig,
  options: RunnerOptions = {},
): Promise<RunnerResult> {
  const domains = gatemem.loadDataset(config.data);
  const policy = loadPreset(config.preset);
  const cache = options.cache ?? fileCache(config.cassettes);
  const usage: UsageRecord[] = [];
  const rows: ProbeResult[] = [];
  const cells = configCells(config);
  for (const item of configItems(config, gatememItems(domains))) {
    const domain = findDomain(domains, item);
    for (const { condition, store } of cells) {
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
            store,
            cache,
            answers: answersFor(config, item, condition, options.live),
            ...(options.offline === undefined ? {} : { offline: options.offline }),
            onUsage: (u) => usage.push(u),
          }),
        );
      }
    }
  }
  // Keyed by condition; with several stores, by `<condition>@<store>` (card B3),
  // C1 as `C1@none`.
  const several = configStores(config).length > 1;
  const summary: RunnerResult["summary"] = {};
  for (const { condition, store } of cells) {
    summary[several ? `${condition}@${store}` : condition] = gatemem.aggregate(
      rows.filter((r) => r.condition === condition && r.store === store).map((r) => r.score),
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
