// The MERIT run config (card B7): what one `make bench BENCH=merit` run
// replays. MERIT's own harness (merit-bench at the pin in PINS.md) runs as an
// external Python process; this config says which of its cells run, under
// which of the pre-registration's conditions, on which stores and seeds, and
// where the cassettes are.
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";

/** merit-bench at the pin in packages/bench/PINS.md (MIT; depend, run as an external process). */
export const MERIT_PIN = {
  repository: "https://github.com/smshweta/merit-bench",
  commit: "293933d96b1d1849e1f20d1bb324def5de9ed33f",
  /** The Python REPRODUCE.md names (`python3.11 -m venv`); uv installs this patch release. */
  python: "3.11.14",
  /** What the environment is installed from, as REPRODUCE.md does it. */
  requirements: "requirements-lock.txt",
} as const;

/**
 * The pre-registration's conditions for H2 on MERIT (C1, C2, C5;
 * docs/research/preregistration.md, H2), each as the runner defines it
 * (packages/runner/src/config.ts, CONDITION_TABLE):
 *
 * - C1 no memory, "long context only": no store and no memory seam. On
 *   GateMem C1 is the benchmark's long-context agent (ADR 0031, decision 3);
 *   MERIT's long-context condition is its own `C1` (FullReplay, every prior
 *   transcript in the prompt), which runs unchanged.
 * - C2 ungoverned: the store directly, no plane; reads by core's retrieval
 *   pipeline over everything the store lists (the runner's ungovernedRead).
 * - C5 enforced: every write through Plane.write and every read through
 *   Plane.read, on a plane read through the core pipeline with the shared
 *   limit (the runner's coreReadPlane), over `engram serve`'s /api/v1.
 */
export const MERIT_CONDITIONS = ["C1", "C2", "C5"] as const;
export type MeritCondition = (typeof MERIT_CONDITIONS)[number];

/** The stores a condition with a store may run on: the runner's (packages/runner/src/stores.ts). */
export const MERIT_STORES = ["fake", "mem0", "letta"] as const;
export type MeritStore = (typeof MERIT_STORES)[number];

/** The store and preset C1's key names: it opens no store and states no policy (statedPreset). */
export const NO_STORE = "none";
export const NO_PRESET = "none";

const Cell = z.strictObject({
  /** MERIT's domain (`merit/domains.py`); the scripted model answers D1 only. */
  domain: z.enum(["d1", "d2", "d3"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  /** `run_pilot.py --arcs`: the first n arcs, each its own seeded world. */
  arcs: z.int().positive(),
  /** `run_pilot.py --episodes`; MERIT's reference runs use 5. */
  episodes: z.int().positive(),
  /**
   * MERIT's own reference run of the same cell, relative to the checkout
   * (`runs/...`), whose rows the slice is compared with.
   */
  reference: z.string().optional(),
});
export type MeritCell = z.infer<typeof Cell>;

export const MeritConfig = z.strictObject({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  /** `pipeline` checks the harness on a fixture slice; its numbers are not results (rule 9). */
  kind: z.literal("pipeline"),
  benchmark: z.literal("merit"),
  cells: z.array(Cell).min(1),
  /**
   * `run_pilot.py --seeds`: MERIT's world seeds 0 to n-1. They generate the
   * worlds and arcs, not the model's samples; the model's seed is `seeds`.
   */
  world_seeds: z.int().positive(),
  conditions: z.array(z.enum(MERIT_CONDITIONS)).min(1),
  stores: z.array(z.enum(MERIT_STORES)).min(1),
  /** The model's seeds (ADR 0017): every call is keyed on one. */
  seeds: z.array(z.int().nonnegative()).min(1),
  preset: z.enum(["strict", "medium", "permissive"]),
  /** `provider/model-id`; only `scripted/...` models are wired (no live run before card X7). */
  model: z.string().regex(/^[a-z0-9-]+\/[A-Za-z0-9._:/-]+$/),
  /** The committed cassettes, relative to the config file. */
  cassettes: z.string(),
});
export type MeritConfig = z.infer<typeof MeritConfig>;

/** A config file, its cassette path resolved against the file's folder. */
export function readMeritConfig(path: string): MeritConfig {
  const config = MeritConfig.parse(JSON.parse(readFileSync(path, "utf8")));
  const unique = <T>(v: readonly T[]) => new Set(v).size === v.length;
  if (!unique(config.conditions) || !unique(config.stores) || !unique(config.seeds)) {
    throw new Error(`${path}: conditions, stores and seeds must not repeat`);
  }
  // Two cells with one item would share keys and output folders (cellItem).
  if (!unique(config.cells.map(cellItem))) {
    throw new Error(
      `${path}: two cells have the same domain and difficulty (item ${config.cells.map(cellItem).join(", ")})`,
    );
  }
  return { ...config, cassettes: resolve(dirname(path), config.cassettes) };
}

/** The item a cell's calls are keyed on (the proxy qualifies it as `merit/<item>`). */
export const cellItem = (cell: MeritCell) => `${cell.domain}-${cell.difficulty}`;

/** The preset a condition's key names: the config's under C5, `none` otherwise (the runner's statedPreset). */
export const keyedPreset = (condition: MeritCondition, preset: string) =>
  condition === "C5" ? preset : NO_PRESET;

/** One run of MERIT's harness: a cell under one condition, store and model seed. */
export interface MeritRunCell {
  cell: MeritCell;
  item: string;
  condition: MeritCondition;
  /** `none` for C1. */
  store: MeritStore | typeof NO_STORE;
  preset: string;
  seed: number;
  /** A folder name: `<item>__<condition>__<store>__s<seed>`. */
  name: string;
}

/** Every run the config names, C1 once per cell and seed (it opens no store). */
export function runCells(config: MeritConfig): MeritRunCell[] {
  const out: MeritRunCell[] = [];
  for (const cell of config.cells) {
    const item = cellItem(cell);
    for (const condition of config.conditions) {
      const stores: (MeritStore | typeof NO_STORE)[] =
        condition === "C1" ? [NO_STORE] : config.stores;
      for (const store of stores) {
        for (const seed of config.seeds) {
          out.push({
            cell,
            item,
            condition,
            store,
            preset: keyedPreset(condition, config.preset),
            seed,
            name: `${item}__${condition}__${store}__s${seed}`,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Why `run-merit.ts --record` may not record into `cassettes`, or undefined
 * when it may: recording reaches a model (refused under ENGRAM_OFFLINE=1),
 * writes fixture cassettes, which only `make fixtures` does (it sets
 * ENGRAM_UPDATE_FIXTURES=1, the variable card B10's proxy asks for), and
 * only into a folder inside `<repo>/fixtures/`. Checked before the folder is
 * emptied or a file cache made, since fileCache creates its folder.
 */
export function fixtureRecordingRefusal(
  cassettes: string,
  repo: string,
  env: NodeJS.ProcessEnv,
): string | undefined {
  if (env.ENGRAM_OFFLINE === "1") {
    return "--record makes model calls; unset ENGRAM_OFFLINE (make fixtures does)";
  }
  if (env.ENGRAM_UPDATE_FIXTURES !== "1") {
    return "--record writes fixture cassettes, which make fixtures records (it sets ENGRAM_UPDATE_FIXTURES=1)";
  }
  const inFixtures = relative(join(resolve(repo), "fixtures"), resolve(cassettes));
  if (inFixtures === "" || inFixtures.startsWith("..") || isAbsolute(inFixtures)) {
    return `--record records into ${join(repo, "fixtures")} only, and ${cassettes} is not inside it`;
  }
  return undefined;
}
