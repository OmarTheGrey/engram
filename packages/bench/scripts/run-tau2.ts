// `make bench BENCH=tau2` (card B11): tau2-bench at its pin on the fixture
// slice, every agent, user-simulator and judge call through the cassette
// proxy, and the memory of C2 and C5 through the store and the plane.
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
// --record (make fixtures only: ENGRAM_UPDATE_FIXTURES=1, never offline)
// empties the config's cassette folder, records every call into it from the
// scripted upstream, and writes the config's expected results; only scripted
// models are wired (no live model before card X11).
//
// Writes results.jsonl (one row per condition, seed and task), usage.jsonl
// (the runner's ledger, card RV1), memory.jsonl (every memory call) and
// summary.json to --out. Exits 1 when a call missed, a tau2 process failed, a
// task raised, or results.jsonl differs from the config's expected results.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { createFilesAdapter } from "@engram/adapters";
import { type CacheStore, fileCache, memoryCache, recordingRefusal } from "@engram/model";
import {
  AGENT_OWNER,
  checkTau2,
  isScriptedModel,
  readTau2Config,
  readTau2Script,
  runTau2,
  scriptedTau2,
  setupTau2,
  summarize,
  tau2Paths,
} from "../src/tau2/index.ts";

const repo = resolve(import.meta.dirname, "..", "..", "..");
const driver = join(import.meta.dirname, "tau2_engram.py");

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
      console.log(`tau2: ready at ${paths.upstream} (pin, Python and lock checked)`);
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
    if (!isScriptedModel(model) || config.script === undefined) {
      console.error(
        `run-tau2: model ${model} is not scripted; live models are not wired (card X11 runs H5)`,
      );
      return 2;
    }
  }
  if (values.record && offline) {
    console.error(
      "run-tau2: --record makes model calls; unset ENGRAM_OFFLINE (make fixtures does)",
    );
    return 2;
  }
  if (values.record && process.env.ENGRAM_UPDATE_FIXTURES !== "1") {
    console.error(
      "run-tau2: --record writes fixture cassettes, which only make fixtures does (ENGRAM_UPDATE_FIXTURES=1)",
    );
    return 2;
  }
  const recorded = join(resolve(values.out), "cassettes");
  // Checked before any file cache is built, since fileCache creates its folder (card B10).
  const fixtures = join(repo, "fixtures");
  const refusal = values.record
    ? config.cassettes.startsWith(`${fixtures}${sep}`)
      ? undefined
      : `--record writes into fixtures/ only, and ${config.cassettes} is not in it`
    : recordingRefusal(recorded, { repo, committed: [config.cassettes] });
  if (refusal !== undefined) {
    console.error(`run-tau2: ${refusal}`);
    return 2;
  }
  const problems = checkTau2(paths);
  if (problems.length > 0) {
    console.error(
      `run-tau2: ${problems.join("; ")}; run node packages/bench/scripts/run-tau2.ts --setup`,
    );
    return 2;
  }
  const out = resolve(values.out);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const script = readTau2Script(config.script as string);
  if (values.record) rmSync(config.cassettes, { recursive: true, force: true });
  const cache = values.record ? fileCache(config.cassettes) : readOnly(config.cassettes, recorded);
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
      let scripted = upstreams.get(item);
      if (scripted === undefined) {
        const own = script[item];
        if (own === undefined) throw new Error(`run-tau2: the script has no task ${item}`);
        scripted = scriptedTau2(item, own);
        upstreams.set(item, scripted);
      }
      // The branded function itself: the proxy refuses a wrapper when recording fixtures.
      return scripted[role];
    },
    openStore: (dir) => createFilesAdapter({ root: dir, owner: AGENT_OWNER }),
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
  const results = jsonl(result.rows);
  writeFileSync(join(out, "results.jsonl"), results);
  writeFileSync(join(out, "usage.jsonl"), jsonl(result.usage));
  writeFileSync(join(out, "memory.jsonl"), jsonl(result.memory));
  writeFileSync(join(out, "summary.json"), `${JSON.stringify(sorted(summary), null, 2)}\n`);
  const lines = [
    `tau2 ${config.domain} (${config.split} split): ${config.tasks.length} tasks under ${config.conditions.join(", ")}, seeds ${config.seeds.join(", ")}`,
    `model calls: ${summary.calls.new} new, ${summary.calls.cached} from cassettes (agent ${summary.roles.agent.calls}, user simulator ${summary.roles.user.calls}, judge ${summary.roles.judge.calls})`,
    ...Object.entries(summary.conditions).map(
      ([c, s]) =>
        `${c}: tau2 reward ${s.tau2_reward.toFixed(3)}, database hash ${s.db_reward.toFixed(3)}, steps ${s.steps.toFixed(1)}, memory writes denied ${s.memory_writes_denied}, tasks failed ${s.failed}`,
    ),
    `cassettes: agent ${summary.roles.agent.cassettes} (${summary.roles.agent.cassette_bytes} bytes), user simulator ${summary.roles.user.cassettes} (${summary.roles.user.cassette_bytes} bytes), judge ${summary.roles.judge.cassettes}, the user simulator's share ${summary.user_cassette_share.toFixed(3)}`,
    `cost: ${summary.cost_usd.toFixed(6)} USD (scripted models)`,
  ];
  let failed = result.errors.length > 0 || result.failures.length > 0;
  for (const f of result.failures) {
    lines.push(`tau2 exited ${f.code} under ${f.condition}, seed ${f.seed}; log ${f.log}`);
  }
  for (const row of result.rows.filter((r) => r.error !== null)) {
    failed = true;
    lines.push(`task ${row.task} failed under ${row.condition}, seed ${row.seed}: ${row.error}`);
  }
  const first = result.errors[0];
  if (first !== undefined) {
    lines.push(
      `proxy errors: ${result.errors.length}, the first ${first.status} ${first.code} on ${first.task} (${first.role}): ${first.message}`,
    );
  }
  if (config.expected !== undefined) {
    if (values.record) {
      // A recording that failed leaves the expected results as they were.
      if (!failed) writeFileSync(config.expected, results);
      lines.push(
        failed
          ? `expected results not written: the recording failed`
          : `expected results written to ${config.expected}`,
      );
    } else if (!existsSync(config.expected) || readFileSync(config.expected, "utf8") !== results) {
      failed = true;
      lines.push(
        `results.jsonl differs from the expected results ${config.expected}; a change to a reward, a step or a memory decision must be re-recorded by make fixtures`,
      );
    } else {
      lines.push(`results equal the expected results ${config.expected}`);
    }
  }
  lines.push(`written to ${out}`);
  console.log(lines.join("\n"));
  return failed ? 1 : 0;
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
