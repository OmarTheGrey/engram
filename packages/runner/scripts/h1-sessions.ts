// A run's results.jsonl as H1 sessions, the results schema `h1-sessions/2`
// of research/analysis/h1.py (docs/tasks/prereg-v1-plan.md, PR 4, part A,
// deliverable 5; packages/runner/src/research/h1-sessions.ts for what a
// session's violation is). Each --config names a runner config and the --run
// after it the folder `make run` wrote for it; the sessions of every pair
// go to --out, in argument order. No model is called.
//
//   node packages/runner/scripts/h1-sessions.ts \
//       --config research/configs/h1-gatemem.json --run .engram/runs/h1-gatemem-live \
//       --config research/configs/h1-mem-inv.json --run .engram/runs/h1-mem-inv-live \
//       [--gate-by-action] [--readings <h1-readings/1 file>] \
//       [--unread-out <file> [--readers <a>,<b>]] --out .engram/runs/h1-sessions.jsonl
//
// `make h1-table` runs exactly this, then research/scripts/h1_table.py. The
// sessions name the config's model: for an H1 experiment config the
// pre-registration's slot (`prereg/M1`); the model that filled it is read
// from the run's usage ledger and printed, and a run whose ledger names more
// than one answer model is refused.
//
// MEM-INV-Bench's UNREAD sessions do not score until two members read them
// (upstream's score.py). --unread-out writes a readings file listing every
// UNREAD attack session with its reply and empty verdicts; the readers fill
// it in locally (it holds model replies: keep it under .engram/) and pass it
// back with --readings, which applies it before scoring.
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
  parseReadings,
  type Reading,
  unreadTemplate,
} from "../src/research/h1-sessions.ts";

const readJsonl = <T>(path: string): T[] =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as T);

interface RunFlags {
  gateByAction: boolean;
  readings: ReadonlyMap<string, Reading>;
  unread: Record<string, unknown>[];
  readers: string[];
}

function convertRun(configPath: string, run: string, flags: RunFlags): Conversion {
  const { gateByAction } = flags;
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
    const rows = readJsonl<MemInvProbeResult>(results);
    flags.unread.push(...unreadTemplate(rows, families, flags.readers).sessions);
    return memInvSessions(rows, families, options, flags.readings);
  }
  return gatememSessions(readJsonl<ProbeResult>(results), options);
}

function main(): number {
  const { values } = parseArgs({
    options: {
      config: { type: "string", multiple: true },
      run: { type: "string", multiple: true },
      "gate-by-action": { type: "boolean", default: false },
      readings: { type: "string" },
      "unread-out": { type: "string" },
      readers: { type: "string", default: "reader1,reader2" },
      out: { type: "string" },
    },
  });
  const configs = values.config ?? [];
  const runs = values.run ?? [];
  if (!values.out || configs.length === 0 || configs.length !== runs.length) {
    console.error(
      "usage: h1-sessions.ts (--config <runner config> --run <run dir>)... [--gate-by-action] [--readings <file>] [--unread-out <file> [--readers <a>,<b>]] --out <sessions.jsonl>",
    );
    return 2;
  }
  const flags: RunFlags = {
    gateByAction: values["gate-by-action"] === true,
    readings:
      values.readings === undefined
        ? new Map()
        : parseReadings(JSON.parse(readFileSync(values.readings, "utf8"))),
    unread: [],
    readers: (values.readers ?? "").split(",").filter(Boolean),
  };
  const lines: string[] = [];
  configs.forEach((configPath, i) => {
    const run = runs[i] as string;
    const out = convertRun(configPath, run, flags);
    lines.push(...out.sessions.map((s) => `${JSON.stringify(s)}\n`));
    const reasons = Object.entries(out.exclusions)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([reason, n]) => `${reason} ${n}`);
    const excluded = Object.values(out.exclusions).reduce((a, b) => a + b, 0);
    console.error(
      `h1-sessions: ${run}: ${out.sessions.length} sessions (${excluded} excluded${reasons.length ? `: ${reasons.join(", ")}` : ""}), ${out.skipped.condition} rows of another condition and ${out.skipped.not_scored} without an H1 violation left out${out.readings_applied ? `; ${out.readings_applied} UNREAD sessions decided by readings` : ""}`,
    );
  });
  writeFileSync(values.out, lines.join(""));
  console.error(`h1-sessions: ${lines.length} sessions written to ${values.out}`);
  if (values["unread-out"] !== undefined) {
    const template = { schema: "h1-readings/1", readers: flags.readers, sessions: flags.unread };
    writeFileSync(values["unread-out"], `${JSON.stringify(template, null, 2)}\n`);
    console.error(
      `h1-sessions: ${flags.unread.length} UNREAD sessions to read written to ${values["unread-out"]}`,
    );
  }
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
