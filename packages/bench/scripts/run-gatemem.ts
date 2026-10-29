// `make bench BENCH=gatemem`: the GateMem pipeline on the vendored fixture
// subset with the scripted model, every call through the committed cassettes.
// Writes predictions.jsonl (GateMem's prediction format), scores.jsonl and
// summary.json (rule-based scorer) to --out and, when the config names a
// judge and its cassettes exist, judge_scores.jsonl and judge_summary.json
// (upstream's LLM judge, judge.ts; the summary promoted as
// score_predictions.py --use_llm_judge writes it).
//
//   node packages/bench/scripts/run-gatemem.ts --config fixtures/bench/gatemem/run-config.json --out .engram/bench/gatemem
//
// Only `scripted/...` models are wired, for the answers and for the judge:
// no live model is called while the pre-registration is backlogged
// (docs/tasks/backlog.md). `make bench` sets ENGRAM_OFFLINE=1, so a cassette
// miss is an error; run directly without it, a miss is recorded under
// <out>/cassettes or <out>/judge-cassettes and the committed cassettes are
// never written. Offline, a judge whose cassettes directory does not exist
// is reported and skipped rather than failing the run.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { type CacheStore, fileCache, memoryCache } from "@engram/runner";
import { readJudgeScript, scriptedJudge } from "../src/gatemem/judge.ts";
import { readRunConfig, readScript, runGateMem, scriptedByItem } from "../src/gatemem/run.ts";

/** The committed cassettes, read and never written; misses are recorded under `recordedDir`. */
function readOnly(committedDir: string | undefined, recordedDir: string): CacheStore {
  const recorded = fileCache(recordedDir);
  // fileCache creates its directory, so a committed one that does not exist is not opened.
  const committed =
    committedDir && existsSync(committedDir) ? fileCache(committedDir) : memoryCache();
  return {
    get: (key) => committed.get(key) ?? recorded.get(key),
    set: (entry) => recorded.set(entry),
  };
}

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
  const j = config.judge;
  if (j && (!j.model.startsWith("scripted/") || !j.script)) {
    console.error(
      `run-gatemem: judge ${j.model} is not scripted; the live judge is not wired (card B1, pre-registration backlogged)`,
    );
    return 2;
  }
  const offline = process.env.ENGRAM_OFFLINE === "1";
  // The committed cassettes are read, never written (finding R6-5).
  const judgeRuns =
    j !== undefined && (!offline || (j.cassettes !== undefined && existsSync(j.cassettes)));
  const result = await runGateMem(config, {
    model: scriptedByItem(readScript(config.script)),
    cache: readOnly(config.cassettes, join(values.out, "cassettes")),
    ...(j && judgeRuns
      ? {
          judge: {
            model: scriptedJudge(readJudgeScript(j.script as string)),
            cache: readOnly(j.cassettes, join(values.out, "judge-cassettes")),
          },
        }
      : {}),
  });
  mkdirSync(values.out, { recursive: true });
  const jsonl = (rows: readonly unknown[]) => rows.map((r) => `${JSON.stringify(r)}\n`).join("");
  const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
  const predictions = jsonl(result.predictions);
  writeFileSync(join(values.out, "predictions.jsonl"), predictions);
  writeFileSync(join(values.out, "scores.jsonl"), jsonl(result.scores));
  writeFileSync(join(values.out, "summary.json"), json(result.summary));
  const fresh = result.usage.filter((u) => !u.hit).length;
  const s = result.summary;
  const lines = [
    `gatemem: ${s.n_checkpoints} checkpoints scored, ${result.predictions.length} predictions`,
    `model calls: ${fresh} new, ${result.usage.length - fresh} from cassettes`,
    `rule-based: action_accuracy ${s.action_accuracy.toFixed(3)}, utility ${s.utility_accuracy.toFixed(3)}, privacy_leak ${s.privacy_leakage_rate.toFixed(3)}, deletion_leak ${s.deletion_leakage_rate.toFixed(3)}`,
  ];
  if (result.judge) {
    const js = result.judge.summary;
    const judgeFresh = result.judge.usage.filter((u) => !u.hit).length;
    writeFileSync(join(values.out, "judge_scores.jsonl"), jsonl(result.judge.rows));
    writeFileSync(join(values.out, "judge_summary.json"), json(result.judge.promoted));
    lines.push(
      `judge calls: ${judgeFresh} new, ${result.judge.usage.length - judgeFresh} from cassettes`,
      `LLM judge (${j?.model}, scripted verdicts; not comparable with the paper): action_ok ${js.judge_action_ok_rate.toFixed(3)}, utility ${js.judge_effective_utility_accuracy.toFixed(3)}, privacy_leak ${js.judge_privacy_leakage_rate.toFixed(3)}, deletion_leak ${js.judge_deletion_leakage_rate.toFixed(3)}, parse failures ${js.judge_parse_failure_rate.toFixed(3)}`,
    );
  } else if (j) {
    lines.push(`LLM judge: not run (offline and no cassettes at ${j.cassettes ?? "(none named)"})`);
  } else {
    lines.push("LLM judge: not run (the config names no judge)");
  }
  lines.push(
    `predictions sha256 ${createHash("sha256").update(predictions).digest("hex")}`,
    `written to ${values.out}`,
  );
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
