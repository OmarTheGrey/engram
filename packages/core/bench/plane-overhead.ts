// The plane-overhead suite (card X15): latency samples of Plane.write and
// Plane.read on the fake and files adapters, per store size and preset,
// beside a bare node:sqlite baseline, with the queries each call makes.
//
//   node packages/core/bench/plane-overhead.ts --config research/configs/perf-budget.json --out <samples.jsonl>
//
// It reads the config's `suite` block and writes one JSON line per record: a
// header (the suite block echoed, Node, tinybench, the machine), then one
// line per (store, size, preset, op) with every timed sample in
// milliseconds, sorted, and the calls' query counts. Timings are not
// byte-stable, so this file is the measurement and research/scripts/
// perf_budget.py computes the committed result from it (AGENTS.md rule 9).
//
// Per (store, size) one log and store are populated through the Plane under
// preset medium (workload.ts), then each preset's plane is timed over them.
// Query counts come from a second plane over the same log through
// countingDb, called once before each cell is timed, so the timed plane's Db
// is not wrapped. The log is a SQLite file in WAL mode in a fresh temporary
// folder, as `engram` keeps it; the files adapter's folder sits beside it.
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { cpus, platform, release, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createFakeAdapter, createFilesAdapter } from "@engram/adapters";
import { Bench } from "tinybench";
import type { Adapter } from "../src/adapter.ts";
import { migrate } from "../src/db/migrate.ts";
import { openSqlite } from "../src/db/sqlite.ts";
import { loadPreset, PRESETS, type PresetName } from "../src/policy/load.ts";
import { countingDb, type QueryCounts } from "./count.ts";
import { BASELINE_OPS, call, OPS, type Op, openBaseline, planeOver, populate } from "./workload.ts";

export type StoreName = "fake" | "files";

export interface SuiteConfig {
  stores: StoreName[];
  sizes: number[];
  presets: PresetName[];
  /** Items the read returns. */
  hits: number;
  /** The injected time of every call. */
  at: string;
  /** Timed calls per cell, by store size, and untimed warm-up calls before them. */
  iterations: Record<string, number>;
  warmup: number;
  /** Per store, sizes skipped (with the reason in the config's notes). */
  skip?: Partial<Record<StoreName, number[]>>;
}

export interface CellRecord {
  record: "cell";
  store: StoreName | "sqlite";
  size: number;
  preset: PresetName | null;
  op: Op | (typeof BASELINE_OPS)[number];
  iterations: number;
  warmup: number;
  samples_ms: number[];
  /** What one call asks of the Db; null for the baseline, which is one statement by construction. */
  queries: QueryCounts | null;
}

/** How long writing the store of `size` items through the Plane took, one write at a time. */
export interface PopulateRecord {
  record: "populate";
  store: StoreName;
  size: number;
  ms: number;
}

export interface HeaderRecord {
  record: "header";
  suite: SuiteConfig;
  node: string;
  tinybench: string;
  machine: { cpu: string; cores: number; memory_bytes: number; os: string; arch: string };
}

const TINYBENCH = "6.2.3";

function header(suite: SuiteConfig): HeaderRecord {
  const cores = cpus();
  return {
    record: "header",
    suite,
    node: process.version,
    tinybench: TINYBENCH,
    machine: {
      cpu: cores[0]?.model.trim() ?? "unknown",
      cores: cores.length,
      memory_bytes: totalmem(),
      os: `${platform()} ${release()}`,
      arch: process.arch,
    },
  };
}

/** Times `fn(n)` with tinybench: `warmup` untimed calls, then exactly `iterations` timed ones. */
async function time(
  name: string,
  fn: (n: number) => unknown,
  iterations: number,
  warmup: number,
  first: number,
): Promise<number[]> {
  let n = first;
  const bench = new Bench({
    name,
    time: 0,
    iterations,
    warmup: warmup > 0,
    warmupTime: 0,
    warmupIterations: warmup,
    retainSamples: true,
    throws: true,
  });
  bench.add(name, async () => {
    await fn(n++);
  });
  await bench.run();
  const task = bench.tasks[0];
  const samples =
    task?.result && "latency" in task.result ? task.result.latency.samples : undefined;
  if (!samples || samples.length !== iterations)
    throw new Error(`${name}: expected ${iterations} samples, got ${samples?.length ?? 0}`);
  return [...samples];
}

async function openStore(store: StoreName, dir: string): Promise<Adapter> {
  if (store === "fake") return createFakeAdapter();
  return createFilesAdapter({ root: join(dir, "memory"), owner: "owner" });
}

export type SuiteProgress = (line: string) => void;

/** Runs the suite; yields each record as it is made. */
export async function* runSuite(
  suite: SuiteConfig,
  progress: SuiteProgress = () => {},
): AsyncGenerator<HeaderRecord | PopulateRecord | CellRecord> {
  yield header(suite);
  const { warmup, hits } = suite;
  for (const size of suite.sizes) {
    const iterations = iterationsAt(suite, size);
    const dir = await mkdtemp(join(tmpdir(), "engram-x15-"));
    try {
      const baseline = openBaseline(join(dir, "baseline.db"), size, hits);
      try {
        for (const op of BASELINE_OPS) {
          const samples = await time(op, baseline.call(op), iterations, warmup, 0);
          progress(`sqlite ${size} ${op}`);
          yield {
            record: "cell",
            store: "sqlite",
            size,
            preset: null,
            op,
            iterations,
            warmup,
            samples_ms: samples,
            queries: null,
          };
        }
      } finally {
        baseline.close();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    for (const store of suite.stores) {
      if (suite.skip?.[store]?.includes(size)) continue;
      const dir = await mkdtemp(join(tmpdir(), "engram-x15-"));
      try {
        yield* storeCells(suite, store, size, dir, progress);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  }
}

async function* storeCells(
  suite: SuiteConfig,
  store: StoreName,
  size: number,
  dir: string,
  progress: SuiteProgress,
): AsyncGenerator<PopulateRecord | CellRecord> {
  const { warmup, hits, at } = suite;
  const iterations = iterationsAt(suite, size);
  const db = openSqlite(join(dir, "engram.db"));
  try {
    migrate(db);
    const adapter = await openStore(store, dir);
    let ids = 0;
    const next = () => ++ids;
    const started = performance.now();
    await populate(planeOver(db, adapter, loadPreset("medium"), next), size, hits, at);
    const ms = performance.now() - started;
    progress(`${store} ${size} populated in ${Math.round(ms)} ms`);
    yield { record: "populate", store, size, ms };
    const counting = countingDb(db);
    for (const preset of suite.presets) {
      const policy = loadPreset(preset);
      const timed = planeOver(db, adapter, policy, next);
      const probe = planeOver(counting.db, adapter, policy, next);
      // Each cell's calls are numbered from their own range: the probe call
      // is 0, the warm-up and timed calls follow it.
      for (const op of OPS) {
        counting.reset();
        await call(probe, op, preset, size, hits, at)(0);
        const queries = counting.counts();
        const samples = await time(
          `${store} ${size} ${preset} ${op}`,
          call(timed, op, preset, size, hits, at),
          iterations,
          warmup,
          1,
        );
        progress(`${store} ${size} ${preset} ${op}`);
        yield {
          record: "cell",
          store,
          size,
          preset,
          op,
          iterations,
          warmup,
          samples_ms: samples,
          queries,
        };
      }
    }
  } finally {
    db.close();
  }
}

/** The timed calls per cell at `size`. */
export function iterationsAt(suite: SuiteConfig, size: number): number {
  const n = suite.iterations[String(size)];
  if (n === undefined || !Number.isInteger(n) || n < 1)
    throw new Error(`the suite block names no iteration count for size ${size}`);
  return n;
}

/** Reads the config's suite block, checking the fields the suite needs. */
export function suiteOf(config: unknown): SuiteConfig {
  const suite = (config as { suite?: SuiteConfig }).suite;
  if (!suite || !Array.isArray(suite.sizes) || !Array.isArray(suite.stores))
    throw new Error("the config has no suite block with stores and sizes");
  for (const p of suite.presets)
    if (!PRESETS.includes(p)) throw new Error(`unknown preset ${p} in the suite block`);
  for (const size of suite.sizes) iterationsAt(suite, size);
  return suite;
}

async function main() {
  const { values } = parseArgs({
    options: { config: { type: "string" }, out: { type: "string" } },
  });
  if (!values.config || !values.out) {
    console.error(
      "usage: node packages/core/bench/plane-overhead.ts --config <file> --out <samples.jsonl>",
    );
    process.exitCode = 2;
    return;
  }
  const suite = suiteOf(JSON.parse(readFileSync(values.config, "utf8")));
  const lines: string[] = [];
  for await (const record of runSuite(suite, (line) => console.error(`x15: ${line}`)))
    lines.push(JSON.stringify(record));
  writeFileSync(values.out, `${lines.join("\n")}\n`, "utf8");
  console.error(`x15: wrote ${lines.length} records to ${values.out}`);
}

if (import.meta.main) await main();
