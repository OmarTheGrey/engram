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
// replayed, offline allowed, every miss an error. Both serve GateMem and
// MEM-INV-Bench configs alike (card X1, plan decision 5). No live run
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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  type AnyRunnerConfig,
  configStores,
  isSuite,
  type RunnerConfig,
  readRunnerConfig,
  readSuite,
} from "../src/config.ts";
import { countConfig, countLines, ensurePinnedData, UnpinnedData } from "../src/count.ts";
import {
  builtinLiveModels,
  LiveRunRefused,
  liveConfig,
  liveOptions,
  replayConfig,
  replayOptions,
} from "../src/live.ts";
import {
  isMemInvConfig,
  type MemInvRunnerConfig,
  readMemInvConfig,
  runMemInvConfig,
  writeMemInvResult,
} from "../src/mem-inv-probe.ts";
import { type RunnerOptions, runConfig, writeRunnerResult } from "../src/run.ts";
import { memInvLines } from "./run-mem-inv.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

interface Flags {
  record: boolean;
  live: boolean;
  replay: boolean;
  count: boolean;
  model?: string | undefined;
  cassettes?: string | undefined;
}

interface Outcome {
  code: number;
  sessions: number;
  calls: { new: number; cached: number };
}

const FAILED: Outcome = { code: 2, sessions: 0, calls: { new: 0, cached: 0 } };

/** The config at `path`, of whichever benchmark it names. */
function readAnyConfig(path: string): { gatemem: RunnerConfig } | { memInv: MemInvRunnerConfig } {
  return isMemInvConfig(path)
    ? { memInv: readMemInvConfig(path) }
    : { gatemem: readRunnerConfig(path) };
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

/** Run, replay, record or count one config into `out`. */
async function runOne(path: string, out: string, flags: Flags): Promise<Outcome> {
  const read = readAnyConfig(path);
  let config: AnyRunnerConfig = "gatemem" in read ? read.gatemem : read.memInv;
  const named = flags.live || flags.replay;

  if (flags.count) {
    const counted = await countConfig(config, { fetch: true, log: (l) => console.log(l) });
    // Paths relative to the repository, so count.json names no machine.
    const dir = relative(REPO, counted.data.dir).replaceAll("\\", "/");
    const count = { ...counted, data: { ...counted.data, dir } };
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "count.json"), `${JSON.stringify(count, null, 2)}\n`);
    console.log([...countLines(count), `written to ${join(out, "count.json")}`].join("\n"));
    return { code: 0, sessions: count.sessions, calls: { new: 0, cached: 0 } };
  }
  if (config.kind === "experiment") {
    if (!named) {
      console.error(
        `run.ts: ${config.name} is an experiment config: it runs on a named model (MODEL=<provider/model> LIVE=1), replays that run (MODEL=<provider/model> REPLAY=1), or is counted (COUNT=1)`,
      );
      return FAILED;
    }
    await ensurePinnedData(config, { fetch: true, log: (l) => console.log(l) });
  }

  let options: RunnerOptions = { offline: !flags.record };
  if (named) {
    const request = {
      model: flags.model as string,
      repo: REPO,
      ...(flags.cassettes === undefined ? {} : { cassettes: resolve(flags.cassettes) }),
    };
    try {
      if (flags.live) {
        config = liveConfig(config, request);
        options = liveOptions(config, builtinLiveModels());
      } else {
        config = replayConfig(config, request);
        options = replayOptions(config);
      }
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
  const footer = named
    ? "live run on a named model; a pipeline config's numbers are still not results"
    : "pipeline config: scripted model, rule-based scorer only; these are not results";

  if ("memInv" in read) {
    const memInv = config as MemInvRunnerConfig;
    const result = await runMemInvConfig(memInv, options);
    writeMemInvResult(result, out);
    console.log(memInvLines(memInv, result, out, how, named).join("\n"));
    return { code: 0, sessions: result.rows.length, calls: result.calls };
  }
  const gm = config as RunnerConfig;
  const result = await runConfig(gm, options);
  writeRunnerResult(result, out);
  const items = gm.items === "all" ? "all" : `${gm.items.length}`;
  const lines = [
    `${gm.name}: ${result.rows.length} sessions (${items} items x ${gm.conditions.join(", ")} x stores ${configStores(gm).join(", ")} x seeds ${gm.seeds.join(", ")}), model ${gm.model}, preset ${gm.preset}`,
    `model calls: ${result.calls.new} new, ${result.calls.cached} from cassettes${how}`,
    ...result.rows.map(
      (r) =>
        `  ${r.condition} ${r.store} seed ${r.seed} ${r.checkpoint_id}: action ${r.output.action} (correct ${r.score.action_correct}), answer leak ${r.score.privacy_leak ?? r.score.deletion_leak}, context leak ${r.score.privacy_context_leak ?? r.score.deletion_context_leak}, ${r.decisions.length} session decisions, plane log ${eventCounts(r.events)}`,
    ),
    footer,
    `written to ${out}`,
  ];
  console.log(lines.join("\n"));
  return { code: 0, sessions: result.rows.length, calls: result.calls };
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
      model: { type: "string" },
      cassettes: { type: "string" },
    },
  });
  if (!values.config || !values.out) {
    console.error(
      "usage: run.ts --config <runner-config.json> --out <dir> [--record | --count | (--live | --replay) --model <provider/model-id> [--cassettes <dir>]]",
    );
    return 2;
  }
  const flags: Flags = {
    record: values.record === true,
    live: values.live === true,
    replay: values.replay === true,
    count: values.count === true,
    model: values.model,
    cassettes: values.cassettes,
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
  if (flags.record && process.env.ENGRAM_OFFLINE === "1") {
    console.error("run.ts: --record with ENGRAM_OFFLINE=1 would record nothing; drop one");
    return 2;
  }
  try {
    if (!isSuite(values.config)) return (await runOne(values.config, values.out, flags)).code;
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
    if (e instanceof UnpinnedData) {
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
