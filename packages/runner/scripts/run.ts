// `make run CONFIG=<file>`: run a runner config (card RN1). Each (item,
// condition, seed) is a pi SDK session; every model call goes through the
// config's cassettes. Writes results.jsonl, summary.json and usage.json to
// --out.
//
//   node packages/runner/scripts/run.ts --config research/configs/rn1-gatemem-probe.json --out .engram/runs/rn1-gatemem-probe
//
// Without --record every miss is an error: a run replays the committed
// cassettes and never writes into fixtures/ (finding R7-11). With --record,
// which only `make fixtures` passes, a miss of a scripted model is answered
// by its script and recorded into the config's cassette directory. Live
// models are not wired here: no paid model is called while the
// pre-registration is backlogged (docs/tasks/backlog.md), so a miss of a
// non-scripted model is an error either way.
import { parseArgs } from "node:util";
import { readRunnerConfig } from "../src/config.ts";
import { runConfig, writeRunnerResult } from "../src/run.ts";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      config: { type: "string" },
      out: { type: "string" },
      record: { type: "boolean", default: false },
    },
  });
  if (!values.config || !values.out) {
    console.error("usage: run.ts --config <runner-config.json> --out <dir> [--record]");
    return 2;
  }
  const config = readRunnerConfig(values.config);
  const record = values.record === true;
  if (record && process.env.ENGRAM_OFFLINE === "1") {
    console.error("run.ts: --record with ENGRAM_OFFLINE=1 would record nothing; drop one");
    return 2;
  }
  const result = await runConfig(config, { offline: !record });
  writeRunnerResult(result, values.out);
  const lines = [
    `${config.name}: ${result.rows.length} sessions (${config.items.length} items x ${config.conditions.join(", ")} x seeds ${config.seeds.join(", ")}), model ${config.model}, preset ${config.preset}, store ${config.store}`,
    `model calls: ${result.calls.new} new, ${result.calls.cached} from cassettes`,
    ...result.rows.map(
      (r) =>
        `  ${r.condition} seed ${r.seed} ${r.checkpoint_id}: action ${r.output.action} (correct ${r.score.action_correct}), answer leak ${r.score.privacy_leak ?? r.score.deletion_leak}, context leak ${r.score.privacy_context_leak ?? r.score.deletion_context_leak}, ${r.decisions.length} plane decisions`,
    ),
    "pipeline config: scripted model, rule-based scorer only; these are not results",
    `written to ${values.out}`,
  ];
  console.log(lines.join("\n"));
  return 0;
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
