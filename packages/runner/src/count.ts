// `make run CONFIG=<file> COUNT=1` (card X1, plan decision 6 of
// docs/tasks/prereg-v1-plan.md): what a config would run, without running
// it. Loads the config, checks its data against the pinned hashes (fetching
// the pinned GateMem full set first when an experiment config's data is
// missing), and counts the sessions per condition, store and seed. No model
// is called and no cassette is read or written: nothing here opens the
// config's cassette directory.
//
// The item kinds (GateMem's query types, MEM-INV-Bench's families and
// laundering channels) are hidden labels (strip.ts in each benchmark); they
// are counted here for the protocol's sizes and reach no session.
import { gatemem, memInvBench } from "@engram/bench";
import {
  type AnyRunnerConfig,
  type Condition,
  configCells,
  configItems,
  configStores,
  type NO_STORE,
} from "./config.ts";
import { gatememItems } from "./run.ts";
import type { StoreName } from "./stores.ts";

/** The data a config names is not the pinned data its kind requires. */
export class UnpinnedData extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnpinnedData";
  }
}

export interface DataCheck {
  dir: string;
  /** `full`: the benchmark's full pinned set; `fixture`: the vendored subset. */
  set: "full" | "fixture";
  commit: string;
}

/**
 * The config's data against the pin: an experiment needs the full pinned set,
 * a pipeline config the full set or the fixture subset. A GateMem experiment
 * whose data is missing has the pinned files fetched first when `fetch` is set
 * (data only, over HTTPS, never a model). Throws UnpinnedData otherwise.
 */
export async function ensurePinnedData(
  config: Pick<AnyRunnerConfig, "benchmark" | "data" | "kind" | "name">,
  options: { fetch?: boolean; log?: (line: string) => void } = {},
): Promise<DataCheck> {
  const check = async () => {
    if (config.benchmark === "gatemem") {
      let found = gatemem.checkGateMemData(config.data);
      if (found.set !== "full" && config.kind === "experiment" && options.fetch) {
        await gatemem.fetchPinnedData(config.data, gatemem.readGateMemManifest(), options.log);
        found = gatemem.checkGateMemData(config.data);
      }
      return {
        set: found.set,
        commit: found.commit,
        detail: `${found.full_files_matching} of 8 full-set files match the manifest`,
      };
    }
    if (config.benchmark === "mem-inv-bench") {
      const found = memInvBench.checkMemInvData(config.data);
      return { ...found, detail: "cases.jsonl against the fixture manifest's line hashes" };
    }
    throw new UnpinnedData(`config ${config.name}: no pinned data known for ${config.benchmark}`);
  };
  const found = await check();
  const wanted = config.kind === "experiment" ? ["full"] : ["full", "fixture"];
  if (!wanted.includes(found.set)) {
    throw new UnpinnedData(
      `config ${config.name}: ${config.data} is not the ${
        config.kind === "experiment" ? "pinned full set" : "pinned full set or fixture subset"
      } of ${config.benchmark} at ${found.commit.slice(0, 7)} (${found.detail})`,
    );
  }
  return { dir: config.data, set: found.set as DataCheck["set"], commit: found.commit };
}

export interface SessionCount {
  config: string;
  kind: AnyRunnerConfig["kind"];
  benchmark: string;
  model: string;
  preset: string;
  data: DataCheck;
  items: number;
  /** Items by their hidden kind label, counted only. */
  item_kinds: Record<string, number>;
  conditions: Condition[];
  stores: StoreName[];
  seeds: number[];
  /** Sessions per (condition, store, seed), in run order; C1's store is `none`. */
  cells: {
    condition: Condition;
    store: StoreName | typeof NO_STORE;
    seed: number;
    sessions: number;
  }[];
  per_condition: Partial<Record<Condition, number>>;
  sessions: number;
}

const tally = (labels: readonly string[]) => {
  const out: Record<string, number> = {};
  for (const l of [...labels].sort()) out[l] = (out[l] ?? 0) + 1;
  return out;
};

/** GateMem's query types in the paper's words. */
const GATEMEM_KIND: Readonly<Record<string, string>> = {
  privacy: "access control",
  safety: "active forgetting",
  utility: "utility",
};

/** The items a config runs, with their hidden kind labels (for counting only). */
function itemsOf(config: AnyRunnerConfig): { ids: string[]; kinds: string[] } {
  if (config.benchmark === "gatemem") {
    const domains = gatemem.loadDataset(config.data);
    const ids = configItems(config, gatememItems(domains));
    const typeOf = new Map(
      domains.flatMap((d) => d.checkpoints.map((c) => [c.checkpoint_id, c.query_type] as const)),
    );
    return {
      ids,
      kinds: ids.map((id) => GATEMEM_KIND[typeOf.get(id) as string] ?? "unknown"),
    };
  }
  const cases = memInvBench.loadCases(config.data);
  const ids = configItems(
    config,
    cases.map((c) => c.case_id),
  );
  const byId = new Map(cases.map((c) => [c.case_id, c]));
  return {
    ids,
    kinds: ids.map((id) => {
      const c = byId.get(id) as memInvBench.Case;
      return c.family === "legit" ? "benign" : `attack/${c.channel}`;
    }),
  };
}

/** What the config would run: sessions per condition, store and seed. No model, no cassette. */
export async function countConfig(
  config: AnyRunnerConfig,
  options: { fetch?: boolean; log?: (line: string) => void } = {},
): Promise<SessionCount> {
  const data = await ensurePinnedData(config, options);
  const { ids, kinds } = itemsOf(config);
  const cells = configCells(config).flatMap(({ condition, store }) =>
    config.seeds.map((seed) => ({ condition, store, seed, sessions: ids.length })),
  );
  const per_condition: SessionCount["per_condition"] = {};
  for (const c of cells)
    per_condition[c.condition] = (per_condition[c.condition] ?? 0) + c.sessions;
  return {
    config: config.name,
    kind: config.kind,
    benchmark: config.benchmark,
    model: config.model,
    preset: config.preset,
    data,
    items: ids.length,
    item_kinds: tally(kinds),
    conditions: [...config.conditions],
    stores: configStores(config),
    seeds: [...config.seeds],
    cells,
    per_condition,
    sessions: cells.reduce((n, c) => n + c.sessions, 0),
  };
}

/** The count as the lines `make run ... COUNT=1` prints. */
export function countLines(count: SessionCount): string[] {
  const kinds = Object.entries(count.item_kinds)
    .map(([k, n]) => `${k} ${n}`)
    .join(", ");
  return [
    `${count.config}: ${count.kind} config, benchmark ${count.benchmark}, model ${count.model}, preset ${count.preset}`,
    `data ${count.data.dir}: the pinned ${count.data.set === "full" ? "full set" : "fixture subset"} at ${count.data.commit.slice(0, 7)}`,
    `items: ${count.items} (${kinds})`,
    `sessions: ${count.sessions} = ${count.items} items x ${count.cells.length / count.seeds.length} condition-store cells (${count.conditions.join(", ")} on ${count.stores.join(", ")}${count.conditions.includes("C1") ? "; C1 once, with no store" : ""}) x ${count.seeds.length} seeds (${count.seeds.join(", ")})`,
    ...Object.entries(count.per_condition).map(([c, n]) => `  ${c}: ${n} sessions`),
    ...count.cells.map((c) => `  ${c.condition} ${c.store} seed ${c.seed}: ${c.sessions} sessions`),
    "no model was called; no cassette was read or written",
  ];
}
