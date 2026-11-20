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
//
// With a journal (card RV1, `make run`), each session's row is appended to
// results.jsonl as it ends and each call's usage to usage.jsonl as it
// returns, so a crashed or stopped run keeps what it finished and a rerun
// with `resume` goes on from there (journal.ts). A row's plane log goes to
// events.jsonl, one line per row in the same order, so results.jsonl stays
// small enough to read at H1's size (RV-EXP-2). Before each session the
// spend ledger is checked against the config's `spend_ceiling_usd`
// (RV-EXP-4): a run that reaches it stops, and its summary is of the
// sessions completed, marked `stopped`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gatemem } from "@engram/bench";
import { loadPreset } from "@engram/core";
import { type CacheStore, fileCache, type UsageRecord } from "@engram/model";
import { answersFor, type LiveModels } from "./answers.ts";
import {
  configCells,
  configItems,
  configJudge,
  configStores,
  type RunnerConfig,
} from "./config.ts";
import { type ProbeResult, probeContext, runProbe } from "./gatemem-probe.ts";
import {
  callCounts,
  RESULTS_FILE,
  type RunJournal,
  SessionSink,
  type Stopped,
  SUMMARY_FILE,
  USAGE_FILE,
  writeJsonl,
} from "./journal.ts";
import { judgeAnswer } from "./judge.ts";
import {
  JUDGE_RETRY,
  type RetryPolicy,
  realSleep,
  retrySession,
  type Sleep,
} from "./model/retry.ts";
import type { Shard } from "./shard.ts";

export type { LiveModels } from "./answers.ts";

/** GateMem's plane log goes beside results.jsonl, one line per row (RV-EXP-2). */
export const EVENTS_FILE = "events.jsonl";

export interface RunnerOptions {
  /** Defaults to the config's cassette directory. */
  cache?: CacheStore;
  /** Refuse misses; unset means ENGRAM_OFFLINE=1 decides. */
  offline?: boolean;
  /** Where misses of a non-scripted model go. Without it such a miss is an error. */
  live?: LiveModels;
  /**
   * Where rows go as each session ends, and where a resumed run's finished
   * sessions are read from (journal.ts). Without one, rows are kept in
   * memory and `writeRunnerResult` writes them.
   */
  journal?: RunJournal;
  /** Told of each row as its session ends (the command line's progress). */
  onRow?: (row: ProbeResult) => void;
  /** How a transient failure's retry waits; a real wait unless a test injects one. */
  sleep?: Sleep;
  /**
   * The outer session retry (review RV1-6, model/retry.ts SESSION_RETRY): a
   * session that stopped on a transient failure its call's retry could not
   * outlast is run again after a wait, its recorded calls from the cassettes.
   * None when unset; `make run` sets it for a live run.
   */
  sessionRetry?: RetryPolicy;
  /**
   * Run only this shard's items (card RV6, shard.ts): the i-th of n
   * contiguous blocks of the config's items, every condition, store and
   * seed of each. No cache key depends on it.
   */
  shard?: Shard;
}

/** What a run's summary is of: the rows' condition, store, score, judge and exclusion. */
type SummaryRow = Pick<ProbeResult, "condition" | "store" | "score" | "judge" | "excluded">;

export interface RunnerResult {
  config: string;
  /** This invocation's rows when the run has no journal; with one they are in its results.jsonl. */
  rows: ProbeResult[];
  /** The sessions the run holds, a resumed run's earlier ones included. */
  sessions: number;
  /** The sessions an earlier invocation finished, which this one skipped. */
  resumed: number;
  /** Per condition, the rule-based summary of its rows (card B1's aggregate). */
  summary: Record<string, ReturnType<typeof gatemem.aggregate>>;
  /**
   * Per condition, when the config has a judge (J1): the judge's summary
   * promoted into the rule-based one as score_predictions.py --use_llm_judge
   * promotes it; its action, utility and leak rates are the paper's.
   */
  judge?: Record<string, Record<string, unknown>>;
  /** Per condition, the sessions left out of the summary by their reason (a turn limit, RV-EXP-5), when any. */
  excluded?: Record<string, Record<string, number>>;
  /** Why the run stopped before its last session (a spend ceiling, RV-EXP-4), when it did. */
  stopped?: Stopped;
  /** This invocation's model calls answered by the answer source (new) and from the cache; written to usage.json only. */
  calls: { new: number; cached: number };
  /** The cost ledger, one record per call (ADR 0017), a journal's earlier invocations included; written to usage.json only. */
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

/** A row as results.jsonl holds it, and its plane log as events.jsonl does. */
export function splitRow(row: ProbeResult): { row: Omit<ProbeResult, "events">; sidecar: unknown } {
  const { events, ...rest } = row;
  const { item, condition, store, seed } = row;
  return { row: rest, sidecar: { item, condition, store, seed, events } };
}

export async function runConfig(
  config: RunnerConfig,
  options: RunnerOptions = {},
): Promise<RunnerResult> {
  const domains = gatemem.loadDataset(config.data);
  const policy = loadPreset(config.preset);
  const cache = options.cache ?? fileCache(config.cassettes);
  const sink = new SessionSink<ProbeResult>({
    journal: options.journal,
    ceiling: config.spend_ceiling_usd,
    split: splitRow,
    onRow: options.onRow,
  });
  const cells = configCells(config);
  const judge = configJudge(config);
  sessions: for (const item of configItems(config, gatememItems(domains), options.shard)) {
    const domain = findDomain(domains, item);
    const checkpoint = domain.checkpoints.find((c) => c.checkpoint_id === item);
    for (const { condition, store } of cells) {
      for (const seed of config.seeds) {
        if (sink.done({ item: `gatemem/${item}`, condition, store, seed })) continue;
        if (!sink.proceed()) break sessions;
        const spec = {
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
          onUsage: sink.onUsage,
          // GateMem's router at the pin retries a transient failure (RV-EXP-1).
          retry: JUDGE_RETRY,
          ...(options.sleep === undefined ? {} : { sleep: options.sleep }),
          ...(config.c4_verdicts === undefined ? {} : { c4Verdicts: config.c4_verdicts }),
          ...(config.read_limit === undefined ? {} : { readLimit: config.read_limit }),
          ...(config.turn_limit === undefined ? {} : { turnLimit: config.turn_limit }),
        };
        const row = await retrySession(
          async () => {
            const probed = await runProbe(spec);
            // GateMem's judge scores the answer as its own scoring does (J1); a
            // session the turn limit cut off is excluded and not judged.
            if (judge && checkpoint && probed.excluded === undefined) {
              probed.judge = await judgeAnswer({
                judge,
                checkpoint,
                output: probed.output,
                seed,
                context: probeContext(spec),
                cache,
                live: options.live,
                offline: options.offline,
                onUsage: sink.onUsage,
                sleep: options.sleep,
              });
            }
            return probed;
          },
          options.sessionRetry,
          options.sleep ?? realSleep,
        );
        sink.commit(row);
      }
    }
  }
  const rows: SummaryRow[] = [];
  sink.forEachRow(({ condition, store, score, judge: j, excluded }) =>
    rows.push({
      condition,
      store,
      score,
      ...(j ? { judge: j } : {}),
      ...(excluded ? { excluded } : {}),
    }),
  );
  const result: RunnerResult = {
    config: config.name,
    rows: sink.rows,
    sessions: sink.sessions,
    resumed: sink.resumed,
    ...summarise(config, rows),
    ...(sink.stopped ? { stopped: sink.stopped } : {}),
    calls: callCounts(sink.usage),
    usage: sink.ledger,
  };
  if (options.journal) finishRun(result, options.journal);
  return result;
}

/** The summaries of a run's rows: keyed by condition; with several stores by `<condition>@<store>` (card B3), C1 as `C1@none`. */
function summarise(
  config: RunnerConfig,
  rows: readonly SummaryRow[],
): Pick<RunnerResult, "summary" | "judge" | "excluded"> {
  const judge = configJudge(config);
  const several = configStores(config).length > 1;
  const summary: RunnerResult["summary"] = {};
  const judged: NonNullable<RunnerResult["judge"]> = {};
  const excluded: NonNullable<RunnerResult["excluded"]> = {};
  for (const { condition, store } of configCells(config)) {
    const key = several ? `${condition}@${store}` : condition;
    const cell = rows.filter((r) => r.condition === condition && r.store === store);
    const out = cell.filter((r) => r.excluded !== undefined);
    if (out.length > 0) {
      const reasons: Record<string, number> = {};
      for (const r of out) reasons[r.excluded as string] = (reasons[r.excluded as string] ?? 0) + 1;
      excluded[key] = reasons;
    }
    const mine = cell.filter((r) => r.excluded === undefined);
    const aggregate = gatemem.aggregate(mine.map((r) => r.score));
    summary[key] = aggregate;
    const judgeRows = mine.flatMap((r) => (r.judge ? [r.judge] : []));
    if (judge && judgeRows.length > 0) {
      judged[key] = gatemem.promoteJudgeMetrics(
        { ...aggregate, gated_by_action: false, judge: "run" },
        gatemem.judgeSummary(judgeRows, false, judge.model),
      );
    }
  }
  return {
    summary,
    ...(judge ? { judge: judged } : {}),
    ...(Object.keys(excluded).length > 0 ? { excluded } : {}),
  };
}

/** summary.json: the summary, the judge's, the exclusions and the stop, each when there is one. */
const summaryFile = ({ config, summary, judge, excluded, stopped }: RunnerResult) => ({
  config,
  summary,
  ...(judge ? { judge } : {}),
  ...(excluded ? { excluded } : {}),
  ...(stopped ? { stopped } : {}),
});

/** A journaled run's summary.json and usage.json (its rows are already in the folder). */
function finishRun(result: RunnerResult, journal: RunJournal): void {
  journal.writeJson(SUMMARY_FILE, summaryFile(result));
  journal.writeJson(USAGE_FILE, {
    config: result.config,
    calls: callCounts(result.usage),
    usage: result.usage,
  });
}

/**
 * results.jsonl (one row per item, condition and seed, without its plane
 * log) and events.jsonl (each row's plane log, in the same order) and
 * summary.json, byte-stable between a recording run and a replay; usage.json,
 * the call counts and the cost ledger, which differ between them. Each file
 * of rows is written a line at a time (RV-EXP-2).
 */
export function writeRunnerResult(result: RunnerResult, out: string): void {
  mkdirSync(out, { recursive: true });
  const parts = result.rows.map(splitRow);
  writeJsonl(
    join(out, RESULTS_FILE),
    parts.map((p) => p.row),
  );
  writeJsonl(
    join(out, EVENTS_FILE),
    parts.map((p) => p.sidecar),
  );
  writeFileSync(join(out, SUMMARY_FILE), `${JSON.stringify(summaryFile(result), null, 2)}\n`);
  const { config, calls, usage } = result;
  writeFileSync(join(out, USAGE_FILE), `${JSON.stringify({ config, calls, usage }, null, 2)}\n`);
}
