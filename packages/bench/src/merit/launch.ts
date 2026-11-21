// The MERIT launcher (card B7): MERIT's own harness as an external process
// whose model calls go through the cassette proxy (card B10, ADR 0036) and
// whose memory calls go through the plane (C5) or the ungoverned baseline
// (C2), with every call's usage in the ledger.
//
// For every (cell, condition, store, seed) the config names it
//
// 1. starts a cassette proxy on a free loopback port, its cell fixed at
//    start: harness `merit`, the cell's item, the condition, the preset the
//    condition's key names, the store and the model's seed. MERIT's runner
//    sends no headers of its own (merit/runner.py calls litellm.completion
//    with the model, messages, tools, temperature and api_base only), so the
//    cell cannot come per request; one proxy serves one cell;
// 2. checks the endpoint MERIT is given with checkHarnessEndpoint;
// 3. opens one memory backend per arc for C2 and C5 (seam.ts);
//
// then runs one MERIT process over every cell (merit-shim.py, which calls
// scripts/run_pilot.py's main per cell with `--model openai/<model>
// --api-base <proxy>/v1`), and closes everything. LiteLLM strips its
// `openai/` prefix, so the proxy sees the config's `provider/model-id`
// (finding 3 of B10). A proxy error (a cassette miss among them) fails the
// run: a run with one did not replay.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { MemoryEvent } from "@engram/core";
import {
  type CacheStore,
  type ChatCall,
  checkHarnessEndpoint,
  type ProxyError,
  type ProxyHandle,
  startProxy,
  type UsageRecord,
} from "@engram/model";
import {
  type MeritCondition,
  type MeritConfig,
  type MeritRunCell,
  NO_STORE,
  runCells,
} from "./config.ts";
import {
  MERIT_ACTOR,
  MERIT_VALID_FROM_BASE,
  type MemoryBackend,
  openMemoryBackend,
} from "./seam.ts";

/** The harness name the proxy qualifies every item with. */
export const MERIT_HARNESS = "merit";

/** The key MERIT's CONDITIONS holds each condition's memory under. C1 is MERIT's own FullReplay. */
export const MERIT_CONDITION_KEY: Readonly<Record<MeritCondition, string>> = {
  C1: "C1",
  C2: "engram-C2",
  C5: "engram-C5",
};

/** The variables the MERIT process gets: what Python and sockets need, no provider key. */
const PASSED_ENV = [
  "PATH",
  "Path",
  "SYSTEMROOT",
  "SystemRoot",
  "WINDIR",
  "COMSPEC",
  "TEMP",
  "TMP",
  "TMPDIR",
  "HOME",
  "USERPROFILE",
  "LOCALAPPDATA",
  "APPDATA",
  "LANG",
];

/**
 * The MERIT process's environment, built from nothing: what Python and
 * sockets need from `env`, and no provider key, so a misconfigured endpoint
 * cannot reach a provider with a real one.
 *
 * - OPENAI_API_KEY: a placeholder; LiteLLM needs one set, the proxy ignores it.
 * - LITELLM_LOCAL_MODEL_COST_MAP: LiteLLM reads its price map from its package
 *   instead of fetching it (its default is a network fetch).
 * - LITELLM_MODE=PRODUCTION: LiteLLM 1.91.1 calls `dotenv.load_dotenv()` at
 *   import unless the mode is other than DEV (`litellm/__init__.py`), and
 *   python-dotenv walks up from LiteLLM's folder (or the working directory)
 *   to the root, so a `.env` with provider keys would load (finding B7-2).
 */
export function meritProcessEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = {};
  for (const name of PASSED_ENV) if (env[name] !== undefined) childEnv[name] = env[name];
  childEnv.OPENAI_API_KEY = "engram-cassette-proxy";
  childEnv.LITELLM_LOCAL_MODEL_COST_MAP = "True";
  childEnv.LITELLM_MODE = "PRODUCTION";
  childEnv.NO_PROXY = "127.0.0.1";
  childEnv.PYTHONIOENCODING = "utf-8";
  return childEnv;
}

/** One ledger row: a call's usage and the run cell it belongs to (the runner's UsageRecord, card RV1). */
export interface LedgerRow extends UsageRecord {
  cell: string;
}

/** One row of MERIT's results.jsonl, the fields the summary reads. */
export interface MeritRow {
  seed: number;
  condition: string;
  arc_id: string;
  episode_index: number;
  /** `none` unless a corruption sweep runs (`run_pilot.py --corrupt`). */
  corrupt_mode: string;
  corrupt_rate: number;
  task_id: string;
  kind: string;
  dependent: boolean;
  success: boolean;
  pre_satisfied: boolean;
  memory_had_fact: boolean;
  memory_utilized: boolean;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface MeritCellRun {
  run: MeritRunCell;
  rows: MeritRow[];
  /** The plane's events per arc (C5), in arc order; empty arrays for C1 and C2. */
  events: MemoryEvent[][];
}

export interface MeritRunOptions {
  config: MeritConfig;
  /** The run's output folder, emptied first. */
  out: string;
  /** The checkout at the pin (env.ts). */
  checkout: string;
  /** MERIT's environment's interpreter (env.ts). */
  python: string;
  /** packages/bench/scripts/merit-shim.py. */
  shim: string;
  /** The cassettes. */
  cache: CacheStore;
  /** Record what the cassettes lack from `upstream` (record mode new_episodes); replay only otherwise. */
  record?: boolean;
  /** The scripted model a recording answers from. */
  upstream?: ChatCall;
  /** The repository root, for the proxy's recording guard (recording.ts). */
  repo?: string;
  /** Recording scripted cassettes into fixtures/, as make fixtures does. */
  recordFixtures?: boolean;
  env?: NodeJS.ProcessEnv;
  /** How long the MERIT process may run; 20 minutes by default. */
  timeoutMs?: number;
}

export interface MeritRunResult {
  cells: MeritCellRun[];
  ledger: LedgerRow[];
  /** MERIT's process output, for the log. */
  stdout: string;
}

/** The run failed: a proxy error, a MERIT process that did not exit 0, or no rows. */
export class MeritRunError extends Error {
  readonly errors: ProxyError[];
  constructor(message: string, errors: ProxyError[] = []) {
    super(message);
    this.name = "MeritRunError";
    this.errors = errors;
  }
}

interface Opened {
  run: MeritRunCell;
  proxy: ProxyHandle;
  endpoint: string;
  backends: MemoryBackend[];
  out: string;
}

function runProcess(
  python: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(python, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveRun({ code, stdout, stderr });
    });
  });
}

const readRows = (path: string): MeritRow[] =>
  existsSync(path)
    ? readFileSync(path, "utf8")
        .split("\n")
        .filter((l) => l.trim() !== "")
        .map((l) => JSON.parse(l) as MeritRow)
    : [];

/** Runs every cell the config names through MERIT's harness, the proxy and the seam. */
export async function runMerit(options: MeritRunOptions): Promise<MeritRunResult> {
  const { config } = options;
  const record = options.record ?? false;
  if (record && options.upstream === undefined) {
    throw new MeritRunError("recording needs the scripted upstream to answer from");
  }
  const out = resolve(options.out);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const ledger: LedgerRow[] = [];
  const opened: Opened[] = [];
  const env = options.env ?? process.env;
  try {
    for (const run of runCells(config)) {
      const proxy = await startProxy({
        cache: options.cache,
        context: {
          harness: MERIT_HARNESS,
          item: run.item,
          condition: run.condition,
          preset: run.preset,
          store: run.store,
          seed: run.seed,
        },
        record: record ? "new_episodes" : "none",
        ...(options.upstream === undefined ? {} : { upstream: options.upstream }),
        onUsage: (usage) => ledger.push({ cell: run.name, ...usage }),
        ...(options.repo === undefined ? {} : { repo: options.repo }),
        ...(options.recordFixtures === true ? { recordFixtures: true } : {}),
        env,
      });
      const entry: Opened = {
        run,
        proxy,
        endpoint: checkHarnessEndpoint(proxy.baseUrl, proxy),
        backends: [],
        out: join(out, run.name),
      };
      opened.push(entry);
      if (run.store !== NO_STORE) {
        const kind = run.condition === "C5" ? "plane" : "ungoverned";
        const memories = run.cell.arcs * config.world_seeds;
        for (let i = 0; i < memories; i++) {
          entry.backends.push(await openMemoryBackend(kind, run.store, config.preset));
        }
      }
    }
    const plan = {
      upstream: resolve(options.checkout),
      cells: opened.map((o) => ({
        name: o.run.name,
        argv: [
          "--model",
          `openai/${config.model}`,
          "--api-base",
          o.endpoint,
          "--domain",
          o.run.cell.domain,
          "--difficulty",
          o.run.cell.difficulty,
          "--arcs",
          String(o.run.cell.arcs),
          "--episodes",
          String(o.run.cell.episodes),
          "--seeds",
          String(config.world_seeds),
          "--conditions",
          MERIT_CONDITION_KEY[o.run.condition],
          "--out",
          o.out,
        ],
        memory:
          o.backends.length === 0
            ? null
            : {
                key: MERIT_CONDITION_KEY[o.run.condition],
                bases: o.backends.map((b) => b.base),
                actor: MERIT_ACTOR,
                valid_from_base: MERIT_VALID_FROM_BASE,
              },
      })),
    };
    const planPath = join(out, "plan.json");
    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);
    const childEnv = meritProcessEnv(env);
    const proc = await runProcess(
      options.python,
      ["-I", "-B", resolve(options.shim), planPath],
      childEnv,
      options.timeoutMs ?? 1_200_000,
    );
    writeFileSync(join(out, "merit-stdout.txt"), proc.stdout);
    writeFileSync(join(out, "merit-stderr.txt"), proc.stderr);
    const errors = opened.flatMap((o) => o.proxy.errors);
    if (errors.length > 0) {
      const first = errors.slice(0, 3).map((e) => `${e.status} ${e.code}: ${e.message}`);
      throw new MeritRunError(
        `the proxy answered ${errors.length} request(s) with an error, so the run did not replay:\n${first.join("\n")}`,
        errors,
      );
    }
    if (proc.code !== 0) {
      throw new MeritRunError(
        `MERIT exited ${proc.code}; its stderr ends:\n${proc.stderr.split("\n").slice(-15).join("\n")}`,
      );
    }
    const cells: MeritCellRun[] = opened.map((o) => {
      const rows = readRows(join(o.out, "results.jsonl"));
      if (rows.length === 0) throw new MeritRunError(`${o.run.name}: MERIT wrote no rows`);
      return { run: o.run, rows, events: o.backends.map((b) => b.events()) };
    });
    return { cells, ledger, stdout: proc.stdout };
  } finally {
    for (const o of opened) {
      await o.proxy.close();
      for (const b of o.backends) await b.close();
    }
  }
}
