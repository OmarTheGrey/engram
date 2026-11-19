// `make run CONFIG=<file>`: run a runner config (card RN1). Each (item,
// condition, store, seed) is a pi SDK session; every model call goes through
// the config's cassettes. Writes results.jsonl, summary.json and usage.json
// to --out.
//
//   node packages/runner/scripts/run.ts --config research/configs/rn1-gatemem-probe.json --out .engram/runs/rn1-gatemem-probe
//
// Without --record or --live every miss is an error: a run replays the
// committed cassettes and never writes into fixtures/ (finding R7-11). With
// --record, which only `make fixtures` passes, a miss of a scripted model is
// answered by its script and recorded into the config's cassette directory.
//
// With --live --model <provider/model-id> (`make run ... MODEL= LIVE=1`,
// card B3, Gate B exception (c)), the probes run on that model through
// pi-ai's built-in providers and record into a new cassette directory outside
// the committed fixtures (src/live.ts); refused under ENGRAM_OFFLINE=1. With
// --replay --model <provider/model-id> (`REPLAY=1`), the same directory is
// replayed, offline allowed, every miss an error. Both serve GateMem,
// MEM-INV-Bench (card X1, plan decision 5) and LongMemEval (card B6) configs. No live run
// happens before the pre-registration is tagged (`prereg-v1`): it is the
// lead's step once the primary model is named and its key supplied.
//
// With --count (`COUNT=1`, card X1, plan decision 6) the config is loaded, its
// data checked against the pinned hashes (an experiment's GateMem data is
// fetched at the pin when missing), and the sessions it would run are printed
// per condition, store and seed, and written to count.json in --out; no model
// is called and no cassette is read or written.
//
// An experiment config (the H1 configs) runs only with --live or --replay and
// a model, or --count; it is never recorded from a script. A suite (a config
// with `suite`, such as research/configs/x1-h1-probe.json) runs each member
// config into --out/<member name>, with the same flags, and prints the total.
//
// Every session run (GateMem, MEM-INV-Bench, LongMemEval) is journaled into
// --out (card RV1, src/journal.ts): each row is appended to results.jsonl as
// its session ends, each call's usage to usage.jsonl as it returns, and each
// row is printed as it ends. A run that crashes or stops keeps them; with
// --resume (`RESUME=1`) a rerun of the same config into the same --out skips
// the sessions it holds and goes on. A run that stops at the config's
// spend_ceiling_usd exits 3, its summary that of the completed sessions.
//
// With --shard i/n (`SHARD=i/n`, card RV6, src/shard.ts) a GateMem,
// MEM-INV-Bench or LongMemEval config runs only the i-th of n contiguous
// blocks of its items, into `<out>-shard-<i>-of-<n>`, against the same
// cassettes; n of them can run at once. Each stops at the config's
// spend_ceiling_usd divided by n. --merge n (`MERGE=n`) joins the n shard
// folders of `<out>` into `<out>`, refusing a missing, unfinished, running
// or overlapping shard and shards of another config, and rewrites the
// summary from the merged rows; no model is called and no session runs.
// One process at a time writes an output folder (run.lock).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { UsageRecord } from "@engram/model";
import {
  type AnyRunnerConfig,
  configStores,
  isSuite,
  type RunnerConfig,
  readRunnerConfig,
  readSuite,
} from "../src/config.ts";
import { countConfig, countLines, ensurePinnedData, UnpinnedData } from "../src/count.ts";
import type { ProbeResult } from "../src/gatemem-probe.ts";
import { JournalMismatch, type Stopped } from "../src/journal.ts";
import {
  countFaultSetConfig,
  type FaultSetRunOptions,
  faultSetCountLines,
  isFaultSetConfig,
  readFaultSetConfig,
  runFaultSetConfig,
  writeFaultSetResult,
} from "../src/lint-fault-set.ts";
import {
  countLintConfig,
  isLintConfig,
  type LintRunnerOptions,
  lintCountLines,
  readLintConfig,
  runLintConfig,
  writeLintResult,
} from "../src/lint-faults.ts";
import {
  builtinLiveModels,
  type LiveRunOptions,
  LiveRunRefused,
  liveConfig,
  liveOptions,
  replayConfig,
  replayOptions,
} from "../src/live.ts";
import {
  isLongMemEvalConfig,
  type LongMemEvalProbeResult,
  longMemEvalJudge,
  readLongMemEvalConfig,
  runLongMemEvalConfig,
} from "../src/longmemeval-probe.ts";
import {
  isMemInvConfig,
  type MemInvRunnerConfig,
  readMemInvConfig,
  runMemInvConfig,
} from "../src/mem-inv-probe.ts";
import { SESSION_RETRY } from "../src/model/retry.ts";
import { EVENTS_FILE, type RunnerOptions, runConfig } from "../src/run.ts";
import {
  openRunJournal,
  parseShard,
  type Shard,
  ShardRefused,
  sealMerge,
  shardConfig,
  shardDir,
  shardLabel,
} from "../src/shard.ts";
import { memInvLines, memInvRowLines, runFooter } from "./run-mem-inv.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

interface Flags {
  record: boolean;
  live: boolean;
  replay: boolean;
  count: boolean;
  /** Continue the run already in --out (card RV1). */
  resume: boolean;
  model?: string | undefined;
  cassettes?: string | undefined;
  /** Run only this shard of the config's items, into its own folder (card RV6). */
  shard?: Shard | undefined;
  /** Merge this many shard folders into --out (card RV6). */
  merge?: number | undefined;
}

interface Outcome {
  code: number;
  sessions: number;
  calls: { new: number; cached: number };
}

const FAILED: Outcome = { code: 2, sessions: 0, calls: { new: 0, cached: 0 } };

/** The exit code of a run that stopped at its spend ceiling: its completed sessions are kept. */
const STOPPED = 3;

/**
 * The journal of a session run into `out` (card RV1): afresh, or resumed
 * with --resume; a shard's; or a merge's (card RV6, src/shard.ts).
 */
const openJournal = (out: string, config: AnyRunnerConfig, flags: Flags, sidecar?: string) =>
  openRunJournal(out, config, {
    resume: flags.resume,
    ...(flags.shard ? { shard: flags.shard } : {}),
    ...(flags.merge === undefined ? {} : { merge: flags.merge }),
    ...(sidecar === undefined ? {} : { sidecar }),
  });

/** What a session run's runner takes from the shard flags (card RV6). */
const shardOptions = (flags: Flags) => (flags.shard ? { shard: flags.shard } : {});

/** The lines a shard or a merge adds to a session run's report. */
function shardLines(flags: Flags, out: string): string[] {
  if (flags.shard) {
    return [
      `shard ${shardLabel(flags.shard)}: this shard's items only; merge the ${flags.shard.count} shards with MERGE=${flags.shard.count}`,
    ];
  }
  if (flags.merge !== undefined) {
    return [
      `merged ${flags.merge} shards (${shardDir(out, { index: 1, count: flags.merge })} to ${shardDir(out, { index: flags.merge, count: flags.merge })}); no session was run`,
    ];
  }
  return [];
}

/** What a journaled run says about what it kept and why it stopped, if it did. */
function journalLines(result: {
  sessions: number;
  resumed: number;
  stopped?: Stopped | undefined;
  usage?: readonly UsageRecord[];
}): string[] {
  // The upstreams OpenRouter served the run's calls from (card RV6), by model.
  const served = new Map<string, number>();
  for (const u of result.usage ?? []) {
    if (u.upstream !== undefined) {
      const k = `${u.model} from ${u.upstream}`;
      served.set(k, (served.get(k) ?? 0) + 1);
    }
  }
  return [
    ...(served.size > 0
      ? [
          `served by: ${[...served]
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([k, n]) => `${k} ${n}`)
            .join(", ")}`,
        ]
      : []),
    ...(result.resumed > 0
      ? [
          `resumed: ${result.resumed} sessions an earlier invocation finished were kept, not run again`,
        ]
      : []),
    ...(result.stopped
      ? [
          `stopped at the spend ceiling: provider ${result.stopped.provider} spent ${result.stopped.spent_usd} USD of ${result.stopped.ceiling_usd}; ${result.sessions} sessions completed, and the summary is theirs; raise spend_ceiling_usd and rerun with RESUME=1 to go on`,
        ]
      : []),
  ];
}

/** One GateMem session as it ends. */
const gatememRowLine = (r: ProbeResult) =>
  `  ${r.condition} ${r.store} seed ${r.seed} ${r.checkpoint_id}: action ${r.output.action} (correct ${r.score.action_correct}), answer leak ${r.score.privacy_leak ?? r.score.deletion_leak}, context leak ${r.score.privacy_context_leak ?? r.score.deletion_context_leak}${judged(r.judge)}, ${r.decisions.length} session decisions, plane log ${eventCounts(r.events)}${r.excluded ? `, excluded (${r.excluded})` : ""}`;

/** One LongMemEval session as it ends. */
function longMemEvalRowLine(r: LongMemEvalProbeResult): string {
  const writes = Object.entries(r.writes)
    .map(([d, n]) => `${d} ${n}`)
    .join(", ");
  return `  ${r.condition} ${r.store} seed ${r.seed} ${r.question_id} (${r.category}): writes ${writes}, stored ${r.stored}, ${r.read.length} reads, judge ${r.judge ? r.judge.label : "none"}, ${r.decisions.length} session decisions${r.excluded ? `, excluded (${r.excluded})` : ""}`;
}

/** The config at `path`, of whichever benchmark it names. */
function readAnyConfig(path: string): { gatemem: RunnerConfig } | { memInv: MemInvRunnerConfig } {
  return isMemInvConfig(path)
    ? { memInv: readMemInvConfig(path) }
    : { gatemem: readRunnerConfig(path) };
}

/** `, judge: action_ok true, leak false`: the judge's verdict on one row, when it ran. */
function judged(
  row:
    | {
        judge: {
          action_ok: boolean;
          privacy_leak: boolean | null;
          deletion_leak: boolean | null;
          utility_ok: boolean | null;
        };
      }
    | undefined,
): string {
  if (!row) return "";
  const j = row.judge;
  return `, judge: action_ok ${j.action_ok}, utility_ok ${j.utility_ok}, leak ${j.privacy_leak ?? j.deletion_leak}`;
}

/** `write allow 96, read allow 1`: the plane's events by op and decision, in first-seen order. */
function eventCounts(events: readonly { op: string; decision: string }[]): string {
  if (events.length === 0) return "empty";
  const counts = new Map<string, number>();
  for (const e of events) {
    const key = `${e.op} ${e.decision}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([k, n]) => `${k} ${n}`).join(", ");
}

/**
 * A LongMemEval config (card B5, the engineering half; card B6). A pipeline
 * config replays its cassettes or records them from its script (--record).
 * An experiment config (H2's baselines, research/configs/h2-longmemeval-*.json)
 * runs on a named model (--live), replays that run (--replay), or is counted
 * (--count), as H1's do; the live run is the lead's step once the
 * pre-registration is tagged and the key supplied.
 */
async function runLongMemEval(path: string, out: string, flags: Flags): Promise<Outcome> {
  let config = shardConfig(readLongMemEvalConfig(path), flags.shard);
  const named = flags.live || flags.replay;
  if (flags.count) return countOne(config, out, flags.shard);
  if (config.kind === "experiment" && !named) {
    console.error(
      `run.ts: ${config.name} is an experiment config: it runs on a named model (MODEL=<provider/model> LIVE=1), replays that run (MODEL=<provider/model> REPLAY=1), or is counted (COUNT=1)`,
    );
    return FAILED;
  }
  let options: LiveRunOptions = { offline: !flags.record };
  if (named) {
    const request = {
      model: flags.model as string,
      repo: REPO,
      ...(flags.cassettes === undefined ? {} : { cassettes: resolve(flags.cassettes) }),
    };
    try {
      // The guards first, so a refused run reads no data and creates no folder.
      config = flags.live ? liveConfig(config, request) : replayConfig(config, request);
      if (config.kind === "experiment") await ensurePinnedData(config);
      options = flags.live ? liveOptions(config, builtinLiveModels()) : replayOptions(config);
    } catch (e) {
      if (e instanceof LiveRunRefused) {
        console.error(e.message);
        return FAILED;
      }
      throw e;
    }
  }
  const how = flags.live
    ? ` (recorded into ${config.cassettes})`
    : flags.replay
      ? ` (replayed from ${config.cassettes})`
      : "";
  const journal = openJournal(out, config, flags);
  let result: Awaited<ReturnType<typeof runLongMemEvalConfig>>;
  try {
    result = await runLongMemEvalConfig(config, {
      ...options,
      journal,
      ...shardOptions(flags),
      ...(flags.live ? { sessionRetry: SESSION_RETRY } : {}),
      onRow: (r) => console.log(longMemEvalRowLine(r)),
    });
    sealMerge(journal);
  } finally {
    journal.close();
  }
  const items = config.items === "all" ? "all" : `${config.items.length}`;
  const lines = [
    `${config.name}: ${result.sessions} sessions (${items} items x ${config.conditions.join(", ")} x stores ${configStores(config).join(", ")} x seeds ${config.seeds.join(", ")}), model ${config.model}, preset ${config.preset}`,
    `model calls: ${result.calls.new} new, ${result.calls.cached} from cassettes${how}`,
    ...shardLines(flags, out),
    ...journalLines(flags.merge === undefined ? result : { ...result, resumed: 0 }),
    ...Object.entries(result.summary).map(
      ([k, s]) =>
        `  ${k}: ${s.judged} of ${s.sessions} judged, overall ${s.breakdown.overall.accuracy ?? "n/a"}, task-averaged ${s.breakdown.task_averaged ?? "n/a"} over ${s.breakdown.types_present} types`,
    ),
    runFooter(
      config.kind,
      named,
      longMemEvalJudge(config) ? "the answer judge" : "no judge; the config names none",
    ),
    `written to ${out}`,
  ];
  console.log(lines.join("\n"));
  return { code: result.stopped ? STOPPED : 0, sessions: result.sessions, calls: result.calls };
}

/**
 * A lint fault-set config (card L3): each fault fixture linted per seed with
 * the config's lint model through its cassettes. A pipeline config replays
 * its committed cassettes (or records them from its script with --record);
 * an experiment config runs on a named model (--live), replays that run
 * (--replay), or is counted (--count), as the H1 configs are.
 */
async function runLint(path: string, out: string, flags: Flags): Promise<Outcome> {
  let config = readLintConfig(path);
  const named = flags.live || flags.replay;
  if (flags.count) {
    const count = countLintConfig(config, REPO);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "count.json"), `${JSON.stringify(count, null, 2)}\n`);
    console.log([...lintCountLines(count), `written to ${join(out, "count.json")}`].join("\n"));
    return {
      code: 0,
      sessions: count.fixtures.length * count.seeds.length,
      calls: { new: 0, cached: 0 },
    };
  }
  if (config.kind === "experiment" && !named) {
    console.error(
      `run.ts: ${config.name} is an experiment config: it runs on a named model (MODEL=<provider/model> LIVE=1), replays that run (MODEL=<provider/model> REPLAY=1), or is counted (COUNT=1)`,
    );
    return FAILED;
  }
  let options: LintRunnerOptions = { offline: !flags.record };
  if (named) {
    const request = {
      model: flags.model as string,
      repo: REPO,
      ...(flags.cassettes === undefined ? {} : { cassettes: resolve(flags.cassettes) }),
    };
    try {
      config = flags.live ? liveConfig(config, request) : replayConfig(config, request);
      options = flags.live ? liveOptions(config, builtinLiveModels()) : replayOptions(config);
    } catch (e) {
      if (e instanceof LiveRunRefused) {
        console.error(e.message);
        return FAILED;
      }
      throw e;
    }
  }
  const result = await runLintConfig(config, options);
  writeLintResult(result, out);
  const how = flags.live
    ? ` (recorded into ${config.cassettes})`
    : flags.replay
      ? ` (replayed from ${config.cassettes})`
      : "";
  const lines = [
    `${config.name}: ${result.rows.length} lint runs (${new Set(result.rows.map((r) => r.fixture)).size} fault fixtures x seeds ${config.seeds.join(", ")}), model ${config.model}`,
    `model calls: ${result.calls.new} new, ${result.calls.cached} from cassettes${how}`,
    ...result.rows.map((r) => {
      const counts = result.summary[`${r.fixture}@${r.seed}`] ?? {};
      const outcomes = Object.entries(counts)
        .map(([k, n]) => `${k} ${n}`)
        .join(", ");
      return `  ${r.fixture} seed ${r.seed}: ${r.judgments.length} units (${outcomes}), ${r.findings.length} findings`;
    }),
    runFooter(
      config.kind,
      named,
      "the fixtures' labels, read only by research/scripts/l3_variance.py",
    ),
    `written to ${out}`,
  ];
  console.log(lines.join("\n"));
  return { code: 0, sessions: result.rows.length, calls: result.calls };
}

/**
 * A seeded-fault set config (card L4): every state of a card L2 set linted
 * per seed with both tiers, the config's lint model through its cassettes.
 * The same modes as a lint fault-fixture config.
 */
async function runFaultSet(path: string, out: string, flags: Flags): Promise<Outcome> {
  let config = readFaultSetConfig(path);
  const named = flags.live || flags.replay;
  if (flags.count) {
    const count = await countFaultSetConfig(config, REPO);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "count.json"), `${JSON.stringify(count, null, 2)}\n`);
    console.log([...faultSetCountLines(count), `written to ${join(out, "count.json")}`].join("\n"));
    return {
      code: 0,
      sessions: count.questions * count.seeds.length,
      calls: { new: 0, cached: 0 },
    };
  }
  if (config.kind === "experiment" && !named) {
    console.error(
      `run.ts: ${config.name} is an experiment config: it runs on a named model (MODEL=<provider/model> LIVE=1), replays that run (MODEL=<provider/model> REPLAY=1), or is counted (COUNT=1)`,
    );
    return FAILED;
  }
  let options: FaultSetRunOptions = { offline: !flags.record };
  if (named) {
    const request = {
      model: flags.model as string,
      repo: REPO,
      ...(flags.cassettes === undefined ? {} : { cassettes: resolve(flags.cassettes) }),
    };
    try {
      config = flags.live ? liveConfig(config, request) : replayConfig(config, request);
      options = flags.live ? liveOptions(config, builtinLiveModels()) : replayOptions(config);
    } catch (e) {
      if (e instanceof LiveRunRefused) {
        console.error(e.message);
        return FAILED;
      }
      throw e;
    }
  }
  const result = await runFaultSetConfig(config, options);
  writeFaultSetResult(result, out);
  const how = flags.live
    ? ` (recorded into ${config.cassettes})`
    : flags.replay
      ? ` (replayed from ${config.cassettes})`
      : "";
  const lines = [
    `${config.name}: ${result.rows.length} lint runs (${new Set(result.rows.map((r) => r.question_id)).size} states x seeds ${config.seeds.join(", ")}), model ${config.model}`,
    `model calls: ${result.calls.new} new, ${result.calls.cached} from cassettes${how}`,
    ...Object.entries(result.summary).map(
      ([seed, counts]) =>
        `  seed ${seed}: ${Object.entries(counts)
          .map(([k, n]) => `${k} ${n}`)
          .join(", ")}`,
    ),
    runFooter(
      config.kind,
      named,
      "the set's labels, read only by research/scripts/h3_lint_delta.py",
    ),
    `written to ${out}`,
  ];
  console.log(lines.join("\n"));
  return { code: 0, sessions: result.rows.length, calls: result.calls };
}

/** COUNT=1: the config's sessions (a shard's, with SHARD=) into count.json in `out`; no model, no cassette. */
async function countOne(config: AnyRunnerConfig, out: string, shard?: Shard): Promise<Outcome> {
  const counted = await countConfig(config, {
    fetch: true,
    log: (l) => console.log(l),
    ...(shard ? { shard } : {}),
  });
  // Paths relative to the repository, so count.json names no machine.
  const dir = relative(REPO, counted.data.dir).replaceAll("\\", "/");
  const count = { ...counted, data: { ...counted.data, dir } };
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "count.json"), `${JSON.stringify(count, null, 2)}\n`);
  console.log([...countLines(count), `written to ${join(out, "count.json")}`].join("\n"));
  return { code: 0, sessions: count.sessions, calls: { new: 0, cached: 0 } };
}

/** Run, replay, record or count one config into `out`. */
async function runOne(path: string, out: string, flags: Flags): Promise<Outcome> {
  if (isLongMemEvalConfig(path)) return runLongMemEval(path, out, flags);
  if (
    (flags.shard || flags.merge !== undefined) &&
    (isLintConfig(path) || isFaultSetConfig(path))
  ) {
    console.error(
      "run.ts: SHARD= and MERGE= split a GateMem, MEM-INV-Bench or LongMemEval session run; a lint config is not split",
    );
    return FAILED;
  }
  if (isLintConfig(path)) return runLint(path, out, flags);
  if (isFaultSetConfig(path)) return runFaultSet(path, out, flags);
  const read = readAnyConfig(path);
  let config: AnyRunnerConfig = shardConfig(
    "gatemem" in read ? read.gatemem : read.memInv,
    flags.shard,
  );
  const named = flags.live || flags.replay;

  if (flags.count) return countOne(config, out, flags.shard);
  if (config.kind === "experiment" && !named) {
    console.error(
      `run.ts: ${config.name} is an experiment config: it runs on a named model (MODEL=<provider/model> LIVE=1), replays that run (MODEL=<provider/model> REPLAY=1), or is counted (COUNT=1)`,
    );
    return FAILED;
  }

  let options: LiveRunOptions = { offline: !flags.record };
  if (named) {
    const request = {
      model: flags.model as string,
      repo: REPO,
      ...(flags.cassettes === undefined ? {} : { cassettes: resolve(flags.cassettes) }),
    };
    try {
      // The guards first, so a refused run fetches nothing and creates no folder.
      config = flags.live ? liveConfig(config, request) : replayConfig(config, request);
      // An experiment runs only on its pinned data (fetched at the pin when missing).
      if (config.kind === "experiment") {
        await ensurePinnedData(config, { fetch: true, log: (l) => console.log(l) });
      }
      options = flags.live ? liveOptions(config, builtinLiveModels()) : replayOptions(config);
    } catch (e) {
      if (e instanceof LiveRunRefused) {
        console.error(e.message);
        return FAILED;
      }
      throw e;
    }
  }
  const how = flags.live
    ? ` (recorded into ${config.cassettes})`
    : flags.replay
      ? ` (replayed from ${config.cassettes})`
      : "";
  if ("memInv" in read) {
    const memInv = config as MemInvRunnerConfig;
    const journal = openJournal(out, memInv, flags);
    let result: Awaited<ReturnType<typeof runMemInvConfig>>;
    try {
      result = await runMemInvConfig(memInv, {
        ...options,
        journal,
        ...shardOptions(flags),
        ...(flags.live ? { sessionRetry: SESSION_RETRY } : {}),
        onRow: (r) => console.log(memInvRowLines(r).join("\n")),
      });
      sealMerge(journal);
    } finally {
      journal.close();
    }
    const lines = memInvLines(memInv, result, out, how, named);
    lines.splice(
      -2,
      0,
      ...shardLines(flags, out),
      ...journalLines(flags.merge === undefined ? result : { ...result, resumed: 0 }),
    );
    console.log(lines.join("\n"));
    return { code: result.stopped ? STOPPED : 0, sessions: result.sessions, calls: result.calls };
  }
  const gm = config as RunnerConfig;
  const journal = openJournal(out, gm, flags, EVENTS_FILE);
  let result: Awaited<ReturnType<typeof runConfig>>;
  try {
    const gatememOptions: RunnerOptions = {
      ...options,
      journal,
      ...shardOptions(flags),
      ...(flags.live ? { sessionRetry: SESSION_RETRY } : {}),
      onRow: (r) => console.log(gatememRowLine(r)),
    };
    result = await runConfig(gm, gatememOptions);
    sealMerge(journal);
  } finally {
    journal.close();
  }
  const items = gm.items === "all" ? "all" : `${gm.items.length}`;
  const lines = [
    `${gm.name}: ${result.sessions} sessions (${items} items x ${gm.conditions.join(", ")} x stores ${configStores(gm).join(", ")} x seeds ${gm.seeds.join(", ")}), model ${gm.model}, preset ${gm.preset}`,
    `model calls: ${result.calls.new} new, ${result.calls.cached} from cassettes${how}`,
    ...shardLines(flags, out),
    ...journalLines(flags.merge === undefined ? result : { ...result, resumed: 0 }),
    runFooter(
      gm.kind,
      named,
      result.judge
        ? "rule-based scorer and the answer judge"
        : "rule-based scorer only; the config names no judge",
    ),
    `written to ${out}`,
  ];
  console.log(lines.join("\n"));
  return { code: result.stopped ? STOPPED : 0, sessions: result.sessions, calls: result.calls };
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      config: { type: "string" },
      out: { type: "string" },
      record: { type: "boolean", default: false },
      live: { type: "boolean", default: false },
      replay: { type: "boolean", default: false },
      count: { type: "boolean", default: false },
      resume: { type: "boolean", default: false },
      model: { type: "string" },
      cassettes: { type: "string" },
      shard: { type: "string" },
      merge: { type: "string" },
    },
  });
  if (!values.config || !values.out) {
    console.error(
      "usage: run.ts --config <runner-config.json> --out <dir> [--record | --count | (--live | --replay) --model <provider/model-id> [--cassettes <dir>]] [--resume] [--shard i/n | --merge n]",
    );
    return 2;
  }
  let shard: Shard | undefined;
  let merge: number | undefined;
  try {
    if (values.shard !== undefined) shard = parseShard(values.shard);
  } catch (e) {
    console.error(`run.ts: ${(e as Error).message}`);
    return 2;
  }
  if (values.merge !== undefined) {
    merge = Number(values.merge);
    if (!/^\d+$/.test(values.merge) || merge < 1) {
      console.error(`run.ts: --merge ${values.merge}: the number of shards is a positive integer`);
      return 2;
    }
  }
  const flags: Flags = {
    record: values.record === true,
    live: values.live === true,
    replay: values.replay === true,
    count: values.count === true,
    resume: values.resume === true,
    model: values.model,
    cassettes: values.cassettes,
    shard,
    merge,
  };
  if ([flags.record, flags.live, flags.replay, flags.count].filter(Boolean).length > 1) {
    console.error("run.ts: --record, --live, --replay and --count are exclusive");
    return 2;
  }
  const named = flags.live || flags.replay;
  if (named !== (flags.model !== undefined) || (!named && flags.cassettes !== undefined)) {
    console.error(
      "run.ts: --model and --cassettes go with --live or --replay, and both need --model",
    );
    return 2;
  }
  if (flags.resume && flags.count) {
    console.error("run.ts: --resume continues a session run; --count runs none");
    return 2;
  }
  if (flags.shard && flags.merge !== undefined) {
    console.error("run.ts: --shard runs one shard; --merge joins them: name one");
    return 2;
  }
  if (flags.merge !== undefined && (flags.record || flags.live || flags.count || flags.resume)) {
    console.error(
      "run.ts: --merge reads finished shards and runs no session: it goes alone, or with --replay --model for a live run's shards",
    );
    return 2;
  }
  if (flags.record && flags.shard) {
    console.error("run.ts: --record is make fixtures' whole run; it is not sharded");
    return 2;
  }
  if (flags.record && process.env.ENGRAM_OFFLINE === "1") {
    console.error("run.ts: --record with ENGRAM_OFFLINE=1 would record nothing; drop one");
    return 2;
  }
  // A shard writes its own folder beside the merged one.
  const out = flags.shard ? shardDir(values.out, flags.shard) : values.out;
  try {
    if (!isSuite(values.config)) return (await runOne(values.config, out, flags)).code;
    if (flags.shard || flags.merge !== undefined) {
      console.error("run.ts: a suite is not sharded; shard each member config");
      return 2;
    }
    const suite = readSuite(values.config);
    let sessions = 0;
    const calls = { new: 0, cached: 0 };
    for (const member of suite.members) {
      const name = (JSON.parse(readFileSync(member, "utf8")) as { name: string }).name;
      const outcome = await runOne(member, join(values.out, name), flags);
      if (outcome.code !== 0) return outcome.code;
      sessions += outcome.sessions;
      calls.new += outcome.calls.new;
      calls.cached += outcome.calls.cached;
    }
    console.log(
      flags.count
        ? `${suite.name}: ${suite.members.length} configs, ${sessions} sessions in all; no model was called`
        : `${suite.name}: ${suite.members.length} configs, ${sessions} sessions; model calls in all: ${calls.new} new, ${calls.cached} from cassettes`,
    );
    return 0;
  } catch (e) {
    if (e instanceof UnpinnedData || e instanceof JournalMismatch || e instanceof ShardRefused) {
      console.error(`run.ts: ${e.message}`);
      return 2;
    }
    throw e;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  },
);
