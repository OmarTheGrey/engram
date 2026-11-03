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
//       --table-config research/configs/h1-table.json [--gate-by-action] \
//       [--readings <filled template> --readings-key <key>] \
//       [--unread-out <file> [--readers <a>,<b>]] --out .engram/runs/h1-sessions.jsonl
//
// `make h1-table` runs exactly this, then research/scripts/h1_table.py. The
// sessions name the config's model: for an H1 experiment config the
// pre-registration's slot (`prereg/M1`); the model that filled it is read
// from the run's usage ledger and printed, and a run whose ledger names more
// than one answer model is refused.
//
// MEM-INV-Bench's UNREAD sessions do not score until two members read them
// (upstream's score.py), and they are not shown the condition (decision
// sheet item 14).
// --unread-out writes the blind template (`h1-blind-readings/1`): each UNREAD
// attack session's reply under an opaque id, in an order the H1 table
// config's seed (--table-config) shuffles, with the case's task and values
// and empty verdicts, and no condition, store, seed or item. Beside it,
// `<name>-key.json` holds the key from id to session; the readers are not
// given it. Both hold model replies or point at them: keep them under
// .engram/. The readers fill a copy of the template, and --readings with
// --readings-key joins it back through the key, which must be the key this
// run and seed give. A readings file keyed by session (`h1-readings/1`) is
// applied as it is. --readings and --unread-out may not name the same file:
// the template a reading was filled in is never overwritten by the run that
// reads it (`make h1-table READINGS=` passes no --unread-out).
//
// GateMem's utility checkpoints become sessions of kind `utility`, for the
// table's MGS only; --gate-by-action is recorded on every session
// (`gate_by_action`), and `make h1-table GATE_BY_ACTION=1` writes those
// sessions to their own file.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { memInvBench } from "@engram/bench";
import { configJudge, readRunnerConfig } from "../src/config.ts";
import type { ProbeResult } from "../src/gatemem-probe.ts";
import { isMemInvConfig, type MemInvProbeResult, readMemInvConfig } from "../src/mem-inv-probe.ts";
import {
  answerModels,
  type Conversion,
  type ConvertOptions,
  gatememSessions,
  joinBlindReadings,
  memInvSessions,
  parseReadings,
  type Reading,
  unreadKeyPath,
  unreadKit,
} from "../src/research/h1-sessions.ts";

const readJsonl = <T>(path: string): T[] =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as T);

const readJson = (path: string, what: string): unknown => {
  if (!existsSync(path)) throw new Error(`no ${what} at ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
};

type Loaded =
  | { kind: "gatemem"; run: string; options: ConvertOptions; rows: ProbeResult[] }
  | {
      kind: "mem-inv";
      run: string;
      options: ConvertOptions;
      rows: MemInvProbeResult[];
      cases: memInvBench.Case[];
    };

function loadRun(configPath: string, run: string, gateByAction: boolean): Loaded {
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
  return memInv
    ? {
        kind: "mem-inv",
        run,
        options,
        rows: readJsonl<MemInvProbeResult>(results),
        cases: memInvBench.loadCases(config.data),
      }
    : { kind: "gatemem", run, options, rows: readJsonl<ProbeResult>(results) };
}

/** The H1 table config's seed, which orders the blind template. */
function tableSeed(path: string | undefined): number {
  if (path === undefined) {
    throw new Error(
      "--table-config <H1 table config> is needed: its seed orders the UNREAD template",
    );
  }
  const { seed } = readJson(path, "H1 table config") as { seed?: unknown };
  if (typeof seed !== "number" || !Number.isInteger(seed)) {
    throw new Error(`${path} names no integer seed`);
  }
  return seed;
}

const USAGE =
  "usage: h1-sessions.ts (--config <runner config> --run <run dir>)... [--table-config <H1 table config>] [--gate-by-action] [--readings <file> [--readings-key <key>]] [--unread-out <file> [--readers <a>,<b>]] --out <sessions.jsonl>";

function main(): number {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean", short: "h", default: false },
      config: { type: "string", multiple: true },
      run: { type: "string", multiple: true },
      "gate-by-action": { type: "boolean", default: false },
      "table-config": { type: "string" },
      readings: { type: "string" },
      "readings-key": { type: "string" },
      "unread-out": { type: "string" },
      readers: { type: "string", default: "reader1,reader2" },
      out: { type: "string" },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  const configs = values.config ?? [];
  const runs = values.run ?? [];
  if (!values.out || configs.length === 0 || configs.length !== runs.length) {
    console.error(USAGE);
    return 2;
  }
  const unreadOut = values["unread-out"];
  if (
    values.readings !== undefined &&
    unreadOut !== undefined &&
    resolve(values.readings) === resolve(unreadOut)
  ) {
    throw new Error(
      `--readings and --unread-out name the same file (${unreadOut}): writing the template would overwrite the readings`,
    );
  }
  const loaded = configs.map((configPath, i) =>
    loadRun(configPath, runs[i] as string, values["gate-by-action"] === true),
  );
  const memInvRows = loaded.flatMap((l) => (l.kind === "mem-inv" ? l.rows : []));
  const cases = new Map(
    loaded.flatMap((l) =>
      l.kind === "mem-inv" ? l.cases.map((c) => [c.case_id, c] as const) : [],
    ),
  );

  let readings: ReadonlyMap<string, Reading> = new Map();
  if (values.readings !== undefined) {
    const value = readJson(values.readings, "readings file");
    if ((value as { schema?: unknown }).schema === "h1-blind-readings/1") {
      const keyPath = values["readings-key"];
      if (keyPath === undefined) {
        throw new Error(
          "a blind readings file is joined through its key: name it with --readings-key (make h1-table passes .engram/runs/h1-unread-key.json)",
        );
      }
      if (!existsSync(keyPath)) {
        throw new Error(
          `no key at ${keyPath}: the key make h1-table wrote beside the template is needed to join the readings`,
        );
      }
      readings = joinBlindReadings(
        value,
        readJson(keyPath, "key"),
        memInvRows,
        cases,
        tableSeed(values["table-config"]),
      );
    } else {
      readings = parseReadings(value);
      if (values["readings-key"] !== undefined) {
        console.error(
          "h1-sessions: readings keyed by session (h1-readings/1): the key is not used",
        );
      }
    }
  }

  const lines: string[] = [];
  for (const l of loaded) {
    const out: Conversion =
      l.kind === "mem-inv"
        ? memInvSessions(
            l.rows,
            new Map(l.cases.map((c) => [c.case_id, c.family])),
            l.options,
            readings,
          )
        : gatememSessions(l.rows, l.options);
    lines.push(...out.sessions.map((s) => `${JSON.stringify(s)}\n`));
    const reasons = Object.entries(out.exclusions)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([reason, n]) => `${reason} ${n}`);
    const excluded = Object.values(out.exclusions).reduce((a, b) => a + b, 0);
    console.error(
      `h1-sessions: ${l.run}: ${out.sessions.length} sessions (${excluded} excluded${reasons.length ? `: ${reasons.join(", ")}` : ""}${out.utility ? `; ${out.utility} utility, for MGS only` : ""}), ${out.skipped.condition} rows of another condition and ${out.skipped.not_scored} without an H1 violation left out${out.readings_applied ? `; ${out.readings_applied} UNREAD sessions decided by readings` : ""}`,
    );
  }
  writeFileSync(values.out, lines.join(""));
  console.error(`h1-sessions: ${lines.length} sessions written to ${values.out}`);

  if (unreadOut !== undefined) {
    const readers = (values.readers ?? "").split(",").filter(Boolean);
    const { template, key } = unreadKit(
      memInvRows,
      cases,
      tableSeed(values["table-config"]),
      readers,
    );
    const keyPath = unreadKeyPath(unreadOut);
    writeFileSync(unreadOut, `${JSON.stringify(template, null, 2)}\n`);
    writeFileSync(keyPath, `${JSON.stringify(key, null, 2)}\n`);
    console.error(
      `h1-sessions: ${template.replies.length} UNREAD replies to read, blind, written to ${unreadOut}; their key, which the readers are not given, to ${keyPath}`,
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
