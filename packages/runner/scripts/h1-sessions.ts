// A run's results.jsonl as H1 sessions, the results schema `h1-sessions/1`
// of research/analysis/h1.py (docs/tasks/prereg-v1-plan.md, PR 4, part A,
// deliverable 5; packages/runner/src/research/h1-sessions.ts for what a
// session's violation is). Each --config names a runner config and the --run
// after it the folder `make run` wrote for it; the sessions of every pair
// go to --out, in argument order. No model is called.
//
//   node packages/runner/scripts/h1-sessions.ts \
//       --config research/configs/h1-gatemem.json --run .engram/runs/h1-gatemem-live \
//       --config research/configs/h1-mem-inv.json --run .engram/runs/h1-mem-inv-live \
//       [--gate-by-action] --out .engram/runs/h1-sessions.jsonl
//
// `make h1-table` runs exactly this, then research/scripts/h1_table.py. The
// sessions name the config's model: for an H1 experiment config the
// pre-registration's slot (`prereg/M1`); the model that filled it is read
// from the run's usage ledger and printed, and a run whose ledger names more
// than one answer model is refused.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { memInvBench } from "@engram/bench";
import { configJudge, readRunnerConfig } from "../src/config.ts";
import type { ProbeResult } from "../src/gatemem-probe.ts";
import { isMemInvConfig, type MemInvProbeResult, readMemInvConfig } from "../src/mem-inv-probe.ts";
import {
  answerModels,
  type Conversion,
  gatememSessions,
  memInvSessions,
} from "../src/research/h1-sessions.ts";

const readJsonl = <T>(path: string): T[] =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as T);

function convertRun(configPath: string, run: string, gateByAction: boolean): Conversion {
  const memInv = isMemInvConfig(configPath);
  const config = memInv ? readMemInvConfig(configPath) : readRunnerConfig(configPath);
  const summary = JSON.parse(readFileSync(join(run, "summary.json"), "utf8")) as { config: string };
  if (summary.config !== config.name) {
    throw new Error(`${run} holds a run of ${summary.config}, not of ${config.name}`);
  }
  const usagePath = join(run, "usage.json");
  if (existsSync(usagePath)) {
    const { usage } = JSON.parse(readFileSync(usagePath, "utf8")) as {
      usage: { model: string }[];
    };
    const models = answerModels(usage, memInv ? undefined : configJudge(config)?.model);
    if (models.length > 1) {
      throw new Error(`${run}: its usage ledger names ${models.join(", ")}; one model per run`);
    }
    console.error(
      `h1-sessions: ${config.name}: model ${config.model}${models[0] && models[0] !== config.model ? ` (run on ${models[0]})` : ""}`,
    );
  }
  const options = { model: config.model, preset: config.preset, gateByAction };
  const results = join(run, "results.jsonl");
  if (memInv) {
    const families = new Map(memInvBench.loadCases(config.data).map((c) => [c.case_id, c.family]));
    return memInvSessions(readJsonl<MemInvProbeResult>(results), families, options);
  }
  return gatememSessions(readJsonl<ProbeResult>(results), options);
}

function main(): number {
  const { values } = parseArgs({
    options: {
      config: { type: "string", multiple: true },
      run: { type: "string", multiple: true },
      "gate-by-action": { type: "boolean", default: false },
      out: { type: "string" },
    },
  });
  const configs = values.config ?? [];
  const runs = values.run ?? [];
  if (!values.out || configs.length === 0 || configs.length !== runs.length) {
    console.error(
      "usage: h1-sessions.ts (--config <runner config> --run <run dir>)... [--gate-by-action] --out <sessions.jsonl>",
    );
    return 2;
  }
  const lines: string[] = [];
  configs.forEach((configPath, i) => {
    const run = runs[i] as string;
    const out = convertRun(configPath, run, values["gate-by-action"] === true);
    lines.push(...out.sessions.map((s) => `${JSON.stringify(s)}\n`));
    console.error(
      `h1-sessions: ${run}: ${out.sessions.length} sessions (${out.excluded} excluded), ${out.skipped.condition} rows of another condition and ${out.skipped.not_scored} without an H1 violation left out`,
    );
  });
  writeFileSync(values.out, lines.join(""));
  console.error(`h1-sessions: ${lines.length} sessions written to ${values.out}`);
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
