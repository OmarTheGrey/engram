// `make bench BENCH=gatemem`: the GateMem pipeline on the vendored fixture
// subset with the scripted model, every call through the committed cassettes.
// Writes predictions.jsonl (GateMem's prediction format), scores.jsonl and
// summary.json (rule-based scorer; the LLM judge is not run) to --out.
//
//   node packages/bench/scripts/run-gatemem.ts --config fixtures/bench/gatemem/run-config.json --out .engram/bench/gatemem
//
// Only `scripted/...` models are wired: no live model is called while the
// pre-registration is backlogged (docs/tasks/backlog.md). With ENGRAM_OFFLINE=1
// a cassette miss is an error.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { fileCache, memoryCache } from "@engram/runner";
import { readRunConfig, readScript, runGateMem, scriptedByItem } from "../src/gatemem/run.ts";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { config: { type: "string" }, out: { type: "string" } },
  });
  if (!values.config || !values.out) {
    console.error("usage: run-gatemem.ts --config <run-config.json> --out <dir>");
    return 2;
  }
  const config = readRunConfig(values.config);
  if (!config.model.startsWith("scripted/") || !config.script) {
    console.error(
      `run-gatemem: model ${config.model} is not scripted; live models are not wired (card B1, pre-registration backlogged)`,
    );
    return 2;
  }
  const result = await runGateMem(config, {
    model: scriptedByItem(readScript(config.script)),
    cache: config.cassettes ? fileCache(config.cassettes) : memoryCache(),
  });
  mkdirSync(values.out, { recursive: true });
  const jsonl = (rows: readonly unknown[]) => rows.map((r) => `${JSON.stringify(r)}\n`).join("");
  const predictions = jsonl(result.predictions);
  writeFileSync(join(values.out, "predictions.jsonl"), predictions);
  writeFileSync(join(values.out, "scores.jsonl"), jsonl(result.scores));
  writeFileSync(join(values.out, "summary.json"), `${JSON.stringify(result.summary, null, 2)}\n`);
  const fresh = result.usage.filter((u) => !u.hit).length;
  const s = result.summary;
  console.log(
    [
      `gatemem: ${s.n_checkpoints} checkpoints scored, ${result.predictions.length} predictions`,
      `model calls: ${fresh} new, ${result.usage.length - fresh} from cassettes`,
      `rule-based: action_accuracy ${s.action_accuracy.toFixed(3)}, utility ${s.utility_accuracy.toFixed(3)}, privacy_leak ${s.privacy_leakage_rate.toFixed(3)}, deletion_leak ${s.deletion_leakage_rate.toFixed(3)}`,
      "LLM judge: not run (scripted model, pipeline check only; not comparable with the paper)",
      `predictions sha256 ${createHash("sha256").update(predictions).digest("hex")}`,
      `written to ${values.out}`,
    ].join("\n"),
  );
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
