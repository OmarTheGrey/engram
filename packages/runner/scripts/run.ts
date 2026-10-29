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
// replayed, offline allowed, every miss an error. No
// live run happens while the pre-registration is backlogged
// (docs/tasks/backlog.md): it is the lead's step once the primary model is
// named and its key supplied.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { configStores, readRunnerConfig } from "../src/config.ts";
import {
  builtinLiveModels,
  LiveRunRefused,
  liveConfig,
  liveOptions,
  replayConfig,
  replayOptions,
} from "../src/live.ts";
import { runConfig, writeRunnerResult } from "../src/run.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      config: { type: "string" },
      out: { type: "string" },
      record: { type: "boolean", default: false },
      live: { type: "boolean", default: false },
      replay: { type: "boolean", default: false },
      model: { type: "string" },
      cassettes: { type: "string" },
    },
  });
  if (!values.config || !values.out) {
    console.error(
      "usage: run.ts --config <runner-config.json> --out <dir> [--record | (--live | --replay) --model <provider/model-id> [--cassettes <dir>]]",
    );
    return 2;
  }
  let config = readRunnerConfig(values.config);
  const record = values.record === true;
  const live = values.live === true;
  const replay = values.replay === true;
  if ([record, live, replay].filter(Boolean).length > 1) {
    console.error("run.ts: --record, --live and --replay are exclusive");
    return 2;
  }
  const named = live || replay;
  if (named !== (values.model !== undefined) || (!named && values.cassettes !== undefined)) {
    console.error(
      "run.ts: --model and --cassettes go with --live or --replay, and both need --model",
    );
    return 2;
  }
  if (record && process.env.ENGRAM_OFFLINE === "1") {
    console.error("run.ts: --record with ENGRAM_OFFLINE=1 would record nothing; drop one");
    return 2;
  }
  let options: Parameters<typeof runConfig>[1] = { offline: !record };
  if (named) {
    const request = {
      model: values.model as string,
      repo: REPO,
      ...(values.cassettes === undefined ? {} : { cassettes: resolve(values.cassettes) }),
    };
    try {
      if (live) {
        config = liveConfig(config, request);
        options = liveOptions(config, builtinLiveModels());
      } else {
        config = replayConfig(config, request);
        options = replayOptions(config);
      }
    } catch (e) {
      if (e instanceof LiveRunRefused) {
        console.error(e.message);
        return 2;
      }
      throw e;
    }
  }
  const result = await runConfig(config, options);
  writeRunnerResult(result, values.out);
  const lines = [
    `${config.name}: ${result.rows.length} sessions (${config.items.length} items x ${config.conditions.join(", ")} x stores ${configStores(config).join(", ")} x seeds ${config.seeds.join(", ")}), model ${config.model}, preset ${config.preset}`,
    `model calls: ${result.calls.new} new, ${result.calls.cached} from cassettes${live ? ` (recorded into ${config.cassettes})` : replay ? ` (replayed from ${config.cassettes})` : ""}`,
    ...result.rows.map(
      (r) =>
        `  ${r.condition} ${r.store} seed ${r.seed} ${r.checkpoint_id}: action ${r.output.action} (correct ${r.score.action_correct}), answer leak ${r.score.privacy_leak ?? r.score.deletion_leak}, context leak ${r.score.privacy_context_leak ?? r.score.deletion_context_leak}, ${r.decisions.length} session decisions, plane log ${eventCounts(r.events)}`,
    ),
    named
      ? "live run on a named model; a pipeline config's numbers are still not results"
      : "pipeline config: scripted model, rule-based scorer only; these are not results",
    `written to ${values.out}`,
  ];
  console.log(lines.join("\n"));
  return 0;
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

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  },
);
