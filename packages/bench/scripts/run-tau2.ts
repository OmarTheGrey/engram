// `make bench BENCH=tau2` (card B11): tau2-bench at its pin on the fixture
// slice, every agent and user-simulator call through the cassette proxy, and
// the memory of C2 and C5 through the store and the plane.
//
//   node packages/bench/scripts/run-tau2.ts --setup
//   ENGRAM_OFFLINE=1 node packages/bench/scripts/run-tau2.ts --config research/configs/b11-tau2-fixture.json --out .engram/bench/tau2
//
// --setup fetches tau2 at the pin into .engram/upstream/tau2-bench and builds
// its own environment from the tag's uv.lock (env.ts); it does nothing when
// both are ready, and is refused under ENGRAM_OFFLINE=1 when they are not.
//
// A run replays the committed cassettes, which are read and never written.
// Under ENGRAM_OFFLINE=1 (make bench) a miss is an error; run without it, a
// miss is answered by the scripted upstream and recorded under <out>/cassettes.
// --record (make fixtures only, never offline) empties the config's cassette
// folder and records every call into it from the scripted upstream, the user
// simulator's included: only scripted models are wired (no live model before
// card X11).
//
// Writes results.jsonl (one row per condition, seed and task), usage.jsonl
// (the runner's ledger, card RV1), memory.jsonl (every memory call) and
// summary.json to --out.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createFilesAdapter } from "@engram/adapters";
import { type CacheStore, fileCache, memoryCache } from "@engram/model";
import {
  AGENT_OWNER,
  checkTau2,
  isScripted,
  readTau2Config,
  readTau2Script,
  runTau2,
  type Served,
  scriptedTau2,
  setupTau2,
  summarize,
  tau2Paths,
} from "../src/tau2/index.ts";

const repo = resolve(import.meta.dirname, "..", "..", "..");
const driver = join(import.meta.dirname, "tau2_engram.py");
const cli = join(repo, "packages", "cli", "src", "main.ts");

/** The committed cassettes, read and never written; misses are recorded under `recordedDir`. */
function readOnly(committedDir: string, recordedDir: string): CacheStore {
  const recorded = fileCache(recordedDir);
  const committed = existsSync(committedDir) ? fileCache(committedDir) : memoryCache();
  return {
    dir: recordedDir,
    get: (key) => committed.get(key) ?? recorded.get(key),
    set: (entry) => recorded.set(entry),
  };
}

/** `engram serve` on a scratch log and files store, on a free loopback port. */
function startPlane(dir: string, preset: string): Promise<Served> {
  return new Promise((done, fail) => {
    const child = spawn(
      process.execPath,
      [
        cli,
        "serve",
        "--store",
        "files",
        "--root",
        join(dir, "store"),
        "--owner",
        AGENT_OWNER,
        "--db",
        join(dir, "log.db"),
        "--policy",
        preset,
        "--port",
        "0",
      ],
      { cwd: repo, stdio: ["ignore", "pipe", "pipe"] },
    );
    let seen = "";
    const stopped = new Promise<void>((r) => child.on("close", () => r()));
    const timer = setTimeout(() => {
      child.kill();
      fail(new Error(`engram serve did not start within 60 s: ${seen}`));
    }, 60_000);
    child.stdout.on("data", (c: Buffer) => {
      seen += c.toString("utf8");
      const m = /listening on (http:\/\/127\.0\.0\.1:\d+)/.exec(seen);
      if (m?.[1] !== undefined) {
        clearTimeout(timer);
        done({
          url: m[1],
          close: async () => {
            child.kill();
            await stopped;
          },
        });
      }
    });
    child.stderr.on("data", (c: Buffer) => {
      seen += c.toString("utf8");
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      fail(e);
    });
  });
}

const jsonl = (rows: readonly unknown[]) =>
  rows.map((r) => `${JSON.stringify(sorted(r))}\n`).join("");

/** `value` with its object keys sorted at every depth, so every file is byte-stable. */
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sorted((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      config: { type: "string" },
      out: { type: "string" },
      record: { type: "boolean", default: false },
      setup: { type: "boolean", default: false },
    },
  });
  const paths = tau2Paths(repo);
  const offline = process.env.ENGRAM_OFFLINE === "1";
  if (values.setup) {
    const problems = checkTau2(paths);
    if (problems.length === 0) {
      console.log(`tau2: ready at ${paths.upstream} (pin checked), Python ${paths.python}`);
      return 0;
    }
    setupTau2(paths, process.env);
    console.log(`tau2: fetched at the pin into ${paths.upstream}, environment ${paths.venv}`);
    return 0;
  }
  if (!values.config || !values.out) {
    console.error("usage: run-tau2.ts --setup | --config <config.json> --out <dir> [--record]");
    return 2;
  }
  const config = readTau2Config(values.config);
  for (const model of [config.agent_model, config.user_model]) {
    if (!isScripted(model) || config.script === undefined) {
      console.error(
        `run-tau2: model ${model} is not scripted; live models are not wired (card X11 runs H5)`,
      );
      return 2;
    }
  }
  if (values.record && offline) {
    console.error("run-tau2: --record makes model calls; unset ENGRAM_OFFLINE (make fixtures does)");
    return 2;
  }
  const problems = checkTau2(paths);
  if (problems.length > 0) {
    console.error(`run-tau2: ${problems.join("; ")}; run node packages/bench/scripts/run-tau2.ts --setup`);
    return 2;
  }
  const out = resolve(values.out);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const script = readTau2Script(config.script as string);
  if (values.record) rmSync(config.cassettes, { recursive: true, force: true });
  const cache = values.record
    ? fileCache(config.cassettes)
    : readOnly(config.cassettes, join(out, "cassettes"));
  const upstreams = new Map<string, ReturnType<typeof scriptedTau2>>();
  const result = await runTau2({
    config,
    out,
    repo,
    python: paths.python,
    driver,
    cache,
    record: offline ? "none" : "new_episodes",
    ...(values.record ? { recordFixtures: true } : { committed: [config.cassettes] }),
    upstream: (item, role) => {
      let pair = upstreams.get(item);
      if (pair === undefined) {
        const own = script[item];
        if (own === undefined) throw new Error(`run-tau2: the script has no task ${item}`);
        pair = scriptedTau2(item, own);
        upstreams.set(item, pair);
      }
      return pair[role];
    },
    openStore: (dir) => createFilesAdapter({ root: dir, owner: AGENT_OWNER }),
    startPlane,
    env: process.env,
  });
  const sizeOf = (key: string) => {
    for (const dir of [config.cassettes, join(out, "cassettes")]) {
      const file = join(dir, `${key}.json`);
      if (existsSync(file)) return statSync(file).size;
    }
    return 0;
  };
  const summary = summarize(result.rows, result.usage, sizeOf);
  writeFileSync(join(out, "results.jsonl"), jsonl(result.rows));
  writeFileSync(join(out, "usage.jsonl"), jsonl(result.usage));
  writeFileSync(join(out, "memory.jsonl"), jsonl(result.memory));
  writeFileSync(join(out, "summary.json"), `${JSON.stringify(sorted(summary), null, 2)}\n`);
  const lines = [
    `tau2 ${config.domain} (${config.split} split): ${config.tasks.length} tasks under ${config.conditions.join(", ")}, seeds ${config.seeds.join(", ")}`,
    `model calls: ${summary.calls.new} new, ${summary.calls.cached} from cassettes (agent ${summary.roles.agent.calls}, user simulator ${summary.roles.user.calls})`,
    ...Object.entries(summary.conditions).map(
      ([c, s]) =>
        `${c}: reward (database hash) ${s.reward.toFixed(3)}, tau2 reward ${s.tau2_reward.toFixed(3)}, steps ${s.steps.toFixed(1)}, memory writes denied ${s.memory_writes_denied}`,
    ),
    `cassettes: agent ${summary.roles.agent.cassettes} (${summary.roles.agent.cassette_bytes} bytes), user simulator ${summary.roles.user.cassettes} (${summary.roles.user.cassette_bytes} bytes), the user simulator's share ${summary.user_cassette_share.toFixed(3)}`,
    `cost: ${summary.cost_usd.toFixed(6)} USD (scripted models)`,
    `written to ${out}`,
  ];
  console.log(lines.join("\n"));
  return result.errors.length === 0 ? 0 : 1;
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
