// The plane-overhead suite (card X15): latency samples of Plane.write and
// Plane.read on the fake and files adapters, per store size and preset,
// beside a bare node:sqlite baseline, with the queries each call makes.
//
//   node packages/core/bench/plane-overhead.ts --config research/configs/perf-budget.json --out <samples.jsonl>
//
// It reads the config's `suite` block and writes one JSON line per record: a
// header (the suite block echoed, Node, tinybench, the machine), one line
// per (store, size) with the time the population took, and one line per
// (store, size, preset, op) with every timed sample in milliseconds, in call
// order, the calls' query counts and the log's size when the cell began.
// Timings are not byte-stable, so this file is the measurement and
// research/scripts/perf_budget.py computes the committed result from it
// (AGENTS.md rule 9).
//
// Per (store, size) one template log and store are populated through the
// Plane under preset medium (workload.ts). Every cell, each (preset, op),
// then runs on its own copy of that template (review finding X15-1): the
// log file and the files adapter's folder are copied, and the fake's
// records are written into a fresh fake, so no cell inherits the items,
// events or reads an earlier cell added, and the run order cannot favour a
// preset. Query counts come from a second plane over the copy through
// countingDb, called once before the cell is timed, so the timed plane's Db
// is not wrapped. The log is a SQLite file in WAL mode in a fresh temporary
// folder, as `engram` keeps it; the files adapter's folder sits beside it.
//
// tinybench drives the warm-up and the timed calls; each call's duration is
// measured around the awaited call with performance.now and handed to
// tinybench as its `overriddenDuration`, so the samples kept are in call
// order and are, sorted, exactly the samples tinybench holds (checked).
import { readFileSync, writeFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { cpus, platform, release, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createFakeAdapter, createFilesAdapter } from "@engram/adapters";
import { Bench } from "tinybench";
import type { Adapter } from "../src/adapter.ts";
import type { Db } from "../src/db/db.ts";
import { migrate } from "../src/db/migrate.ts";
import { openSqlite } from "../src/db/sqlite.ts";
import { accessTime } from "../src/plane/read.ts";
import { loadPreset, PRESETS, type PresetName } from "../src/policy/load.ts";
import type { MemoryItem } from "../src/schema.ts";
import { countingDb, type QueryCounts } from "./count.ts";
import {
  BASELINE_OPS,
  backgroundScope,
  call,
  OPS,
  type Op,
  openBaseline,
  planeOver,
  populate,
  scopeCount,
} from "./workload.ts";

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
  /** Every timed call's duration in milliseconds, in call order. */
  samples_ms: number[];
  /** What one call asks of the Db; null for the baseline, which is one statement by construction. */
  queries: QueryCounts | null;
  /** The log (items and events) or the baseline table (items) when the cell began, before its probe call. */
  start: { items: number; events: number | null };
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

/**
 * Times `fn(n)` with tinybench: `warmup` untimed calls, then exactly
 * `iterations` timed ones. Returns the timed durations in call order.
 */
async function time(
  name: string,
  fn: (n: number) => unknown,
  iterations: number,
  warmup: number,
  first: number,
): Promise<number[]> {
  let n = first;
  let phase: string | undefined;
  const ordered: number[] = [];
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
  bench.add(
    name,
    async () => {
      const t0 = performance.now();
      await fn(n++);
      const ms = performance.now() - t0;
      if (phase === "run") ordered.push(ms);
      return { overriddenDuration: ms };
    },
    {
      async: true,
      beforeEach(mode) {
        phase = mode;
      },
    },
  );
  await bench.run();
  const task = bench.tasks[0];
  const samples =
    task?.result && "latency" in task.result ? task.result.latency.samples : undefined;
  if (!samples || samples.length !== iterations || ordered.length !== iterations)
    throw new Error(`${name}: expected ${iterations} samples, got ${samples?.length ?? 0}`);
  const sorted = [...ordered].sort((a, b) => a - b);
  if (sorted.some((ms, i) => ms !== samples[i]))
    throw new Error(`${name}: the call-order samples are not tinybench's samples`);
  return ordered;
}

/** How many items and events the log holds. */
function logSize(db: Db): { items: number; events: number } {
  const count = (table: string) =>
    Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n ?? 0);
  return { items: count("items"), events: count("events") };
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
      // Each baseline op on its own fresh table of `size` rows, as each plane cell.
      for (const [k, op] of BASELINE_OPS.entries()) {
        const baseline = openBaseline(join(dir, `baseline-${k}.db`), size, hits);
        try {
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
            start: { items: size, events: null },
          };
        } finally {
          baseline.close();
        }
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
  // The template: populated once, then closed, so its WAL is checkpointed
  // into the database file before the file is copied.
  const template = join(dir, "template");
  await mkdir(template);
  let ids = 0;
  const next = () => ++ids;
  let records: MemoryItem[] = [];
  const db = openSqlite(join(template, "engram.db"));
  let ms = 0;
  try {
    migrate(db);
    const adapter = await openStore(store, template);
    const started = performance.now();
    await populate(planeOver(db, adapter, loadPreset("medium"), next), size, hits, at);
    ms = performance.now() - started;
    if (store === "fake") {
      const scopes = Array.from({ length: scopeCount(size) }, (_, k) => backgroundScope(k));
      records = (await Promise.all(scopes.map((scope) => adapter.list(scope)))).flat();
    }
  } finally {
    db.close();
  }
  progress(`${store} ${size} populated in ${Math.round(ms)} ms`);
  yield { record: "populate", store, size, ms };
  const templateIds = ids;
  let k = 0;
  for (const preset of suite.presets) {
    const policy = loadPreset(preset);
    for (const op of OPS) {
      const cell = join(dir, `cell-${k++}`);
      await cp(template, cell, { recursive: true });
      const cellDb = openSqlite(join(cell, "engram.db"));
      try {
        const adapter = await openStore(store, cell);
        // The fake keeps its records in memory: its copy is the template's
        // records written into a fresh fake, as `cp` copies the files
        // adapter's folder; the log copy already holds their events.
        for (const record of records) await adapter.write(record);
        const start = logSize(cellDb);
        // Every cell numbers its events from where the template stopped.
        let cellIds = templateIds;
        const nextId = () => ++cellIds;
        const counting = countingDb(cellDb);
        const timed = planeOver(cellDb, adapter, policy, nextId);
        const probe = planeOver(counting.db, adapter, policy, nextId);
        // A Db handle's first look at the log's head reads every event
        // (plane/read.ts, logHead); the probe's handle takes it before it is
        // counted, so the counts are a steady call's, as the timed calls are
        // after their warm-up.
        accessTime(counting.db, at);
        counting.reset();
        // The probe call is 0; the warm-up and timed calls follow it.
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
          start,
        };
      } finally {
        cellDb.close();
        await rm(cell, { recursive: true, force: true });
      }
    }
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
