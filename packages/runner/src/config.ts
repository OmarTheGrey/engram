// The runner config (card RN1): which benchmark items run, under which
// conditions (docs/research/preregistration.md, C1 to C7), with which model,
// seeds, policy preset and store. Every seed comes from here (AGENTS.md rule
// 6) and every cache key part besides the prompt does too (rule 7, ADR 0017).
// Paths are relative to the config file, as in the B1 run config.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PRESETS } from "@engram/core";
import { z } from "zod";
import { STORES, type StoreName } from "./stores.ts";

/**
 * The conditions this runner builds (card X1, ADR 0031). C6 needs the lint
 * cards and C7 the MCP path of ADR 0022; neither is built yet.
 */
export const CONDITIONS = ["C1", "C2", "C3", "C4", "C5"] as const;
export const Condition = z.enum(CONDITIONS);
export type Condition = z.infer<typeof Condition>;

/**
 * What each condition is, as the pre-registration's Conditions table defines
 * it, and the only place the runner reads a condition's mechanism from:
 * - `memory`: where memory reaches the model from. `context`: the prompt
 *   holds the long context and there is no memory tool (C1); `store`: the
 *   memory tools over the store with no plane (C2, C3, C4); `plane`: the
 *   Engram extension on the real Plane at the config's preset (C5).
 * - `policyText`: the policy as text in the system prompt (C3, C4).
 * - `metadata`: each item a read returns carries requester and policy
 *   metadata, and a legend of it is in the system prompt; the model decides
 *   from it (C4).
 * Neighbours differ only in these columns (ADR 0015, decision D13).
 */
export interface ConditionMechanism {
  name: string;
  memory: "context" | "store" | "plane";
  policyText: boolean;
  metadata: boolean;
}

export const CONDITION_TABLE: Readonly<Record<Condition, ConditionMechanism>> = {
  C1: { name: "no memory", memory: "context", policyText: false, metadata: false },
  C2: { name: "ungoverned", memory: "store", policyText: false, metadata: false },
  C3: { name: "instruction", memory: "store", policyText: true, metadata: false },
  C4: { name: "instruction with metadata", memory: "store", policyText: true, metadata: true },
  C5: { name: "enforced", memory: "plane", policyText: false, metadata: false },
};

/** What each condition is, in the pre-registration's words. */
export const CONDITION_NAMES: Readonly<Record<Condition, string>> = Object.fromEntries(
  CONDITIONS.map((c) => [c, CONDITION_TABLE[c].name]),
) as Record<Condition, string>;

/**
 * The preset a condition's cache key names: the config's when the condition
 * states the policy (C3, C4) or enforces it (C5), `none` when it does
 * neither (C1, C2), so a preset sweep never re-pays for them.
 */
export function statedPreset(condition: Condition, preset: string): string {
  const m = CONDITION_TABLE[condition];
  return m.policyText || m.memory === "plane" ? preset : "none";
}

/** C1 holds its memory in the prompt and opens no store; its rows and keys name this store. */
export const NO_STORE = "none";

/** Whether a condition reads memory from a store (every condition but C1). */
export const usesStore = (condition: Condition) => CONDITION_TABLE[condition].memory !== "context";

export { STORES } from "./stores.ts";

const unique = <T>(values: readonly T[]) => new Set(values).size === values.length;

export const C4_VERDICT_SOURCES = ["engram", "gatemem-rag"] as const;

export const RunnerConfig = z.strictObject({
  /** Names the run in results and cassettes. */
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  /**
   * `pipeline` checks the runner on fixtures with a scripted model; it is not
   * a registered experiment and its numbers are not results (AGENTS.md rule
   * 9). `experiment` is a registered experiment's protocol (the H1 configs,
   * plan decision 6): it runs only on a named live model (`--live`), as a
   * replay of that run (`--replay`), or is counted (`--count`); its `model`
   * names the pre-registration's slot (for example `prereg/M1`) and the
   * command line names the model that fills it.
   */
  kind: z.enum(["pipeline", "experiment"]),
  benchmark: z.literal("gatemem"),
  /** GateMem data root, one directory per domain. */
  data: z.string(),
  /** Checkpoint ids, or `all`: every checkpoint of the data, in file order. */
  items: z.union([
    z.literal("all"),
    z.array(z.string().min(1)).min(1).refine(unique, "items must be unique"),
  ]),
  conditions: z.array(Condition).min(1).refine(unique, "conditions must be unique"),
  /** `provider/model-id`. `scripted/<id>` answers misses from `script`. */
  model: z.string().regex(/^[^/\s]+\/\S+$/, "model must be provider/model-id"),
  seeds: z.array(z.number().int()).min(1).refine(unique, "seeds must be unique"),
  /** The policy preset C3 and C4 state and C5 enforces. */
  preset: z.enum(PRESETS),
  /** One store, or several (card B3): each item runs on every store named. */
  store: z.union([
    z.enum(STORES),
    z.array(z.enum(STORES)).min(1).refine(unique, "stores must be unique"),
  ]),
  /**
   * The scripted model's steps by checkpoint id, or by `<id>@<condition>` for
   * a condition whose session differs (C1 has no memory tool). Required for
   * a scripted model.
   */
  script: z.string().optional(),
  /** The cassette directory (a fileCache). */
  cassettes: z.string(),
  /**
   * Where C4's per-item `access` verdict comes from on GateMem (ADR 0031):
   * `engram`, the plane's own read decision under the preset C5 enforces
   * (the default, so C4 and C5 differ in mechanism only), or `gatemem-rag`,
   * GateMem's RAG-Policy rule table (packages/bench gatemem/rag-policy.ts).
   */
  c4_verdicts: z.enum(C4_VERDICT_SOURCES).optional(),
  /**
   * The answer judge, as GateMem scores its access, forgetting and utility
   * checkpoints (card B1's port, packages/bench gatemem/judge.ts): a model,
   * its temperature and output limit, and for a scripted judge its replies
   * by checkpoint. An experiment config without one uses the paper's
   * (`openai/gpt-4o`, temperature 0, 4096 tokens). Every judge call is
   * cached and keyed like an answer call (ADR 0017).
   */
  judge: z
    .strictObject({
      model: z.string().regex(/^[^/\s]+\/\S+$/, "judge model must be provider/model-id"),
      temperature: z.number().min(0).default(0),
      max_tokens: z.number().int().positive().default(4096),
      script: z.string().optional(),
    })
    .optional(),
});
export type RunnerConfig = z.infer<typeof RunnerConfig>;

/** The sources of C4's GateMem verdict; `engram` is the default (ADR 0031). */
export type C4VerdictSource = (typeof C4_VERDICT_SOURCES)[number];

/** What every runner config has in common, whatever its benchmark. */
export type AnyRunnerConfig = Omit<RunnerConfig, "benchmark" | "store"> & {
  benchmark: string;
  store: StoreName | StoreName[];
};

/** The checks every runner config passes beyond its schema. */
export function checkConfig<C extends AnyRunnerConfig>(config: C): C {
  const scripted = config.model.startsWith("scripted/");
  if (scripted && config.script === undefined) {
    throw new Error(`config ${config.name}: a scripted model needs a script`);
  }
  const judge = config.judge;
  if (
    config.kind === "experiment" &&
    (scripted ||
      config.script !== undefined ||
      judge?.model.startsWith("scripted/") ||
      judge?.script !== undefined)
  ) {
    throw new Error(
      `config ${config.name}: an experiment runs on a live model and a live judge, never a scripted one or a script`,
    );
  }
  if (judge?.model.startsWith("scripted/") && judge.script === undefined) {
    throw new Error(`config ${config.name}: a scripted judge needs a script`);
  }
  return config;
}

/** The config with its paths resolved against `base`. */
export function resolvePaths<C extends AnyRunnerConfig>(config: C, base: string): C {
  const judge = config.judge;
  return {
    ...config,
    data: resolve(base, config.data),
    cassettes: resolve(base, config.cassettes),
    ...(config.script === undefined ? {} : { script: resolve(base, config.script) }),
    ...(judge?.script === undefined
      ? {}
      : { judge: { ...judge, script: resolve(base, judge.script) } }),
  };
}

/** The paper's judge (GateMem's score_predictions.py defaults): what an experiment uses when it names none. */
export const PAPER_JUDGE_CONFIG = {
  model: "openai/gpt-4o",
  temperature: 0,
  max_tokens: 4096,
} as const;

/** The judge a GateMem config runs: its own, the paper's for an experiment that names none, else none. */
export function configJudge(
  config: Pick<AnyRunnerConfig, "judge" | "kind">,
): NonNullable<RunnerConfig["judge"]> | undefined {
  return config.judge ?? (config.kind === "experiment" ? { ...PAPER_JUDGE_CONFIG } : undefined);
}

export function parseRunnerConfig(value: unknown, base = process.cwd()): RunnerConfig {
  return resolvePaths(checkConfig(RunnerConfig.parse(value)), base);
}

/** The stores a config runs on, in its order. */
export const configStores = (config: Pick<AnyRunnerConfig, "store">): StoreName[] =>
  typeof config.store === "string" ? [config.store] : [...config.store];

/** The config's items: its list, or every id of the data in order when it says `all`. */
export function configItems(
  config: Pick<AnyRunnerConfig, "items" | "name">,
  available: readonly string[],
): string[] {
  if (config.items === "all") return [...available];
  const known = new Set(available);
  const missing = config.items.filter((i) => !known.has(i));
  if (missing.length > 0) {
    throw new Error(`config ${config.name}: no item ${missing.join(", ")} in the data`);
  }
  return [...config.items];
}

/**
 * The (condition, store) cells a config runs, in run order: every condition
 * on every store, except C1, which opens no store and runs once, under
 * NO_STORE, with the first store's sessions.
 */
export function configCells(
  config: Pick<AnyRunnerConfig, "conditions" | "store">,
): { condition: Condition; store: StoreName | typeof NO_STORE }[] {
  const cells: { condition: Condition; store: StoreName | typeof NO_STORE }[] = [];
  configStores(config).forEach((store, s) => {
    for (const condition of config.conditions) {
      if (usesStore(condition)) cells.push({ condition, store });
      else if (s === 0) cells.push({ condition, store: NO_STORE });
    }
  });
  return cells;
}

/** Read a config file; its paths are resolved against the file's directory. */
export function readRunnerConfig(path: string): RunnerConfig {
  return parseRunnerConfig(JSON.parse(readFileSync(path, "utf8")), dirname(resolve(path)));
}

/**
 * A suite (card X1): several runner configs run as one, each into its own
 * output folder, for example one per arm of a hypothesis. Paths are relative
 * to the suite file.
 */
export const RunnerSuite = z.strictObject({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  kind: z.literal("pipeline"),
  suite: z.array(z.string().min(1)).min(1).refine(unique, "suite members must be unique"),
});
export type RunnerSuite = z.infer<typeof RunnerSuite>;

/** Whether the JSON at `path` is a suite. */
export const isSuite = (path: string): boolean =>
  (JSON.parse(readFileSync(path, "utf8")) as { suite?: unknown }).suite !== undefined;

/** A suite file's name and the absolute paths of its member configs, in order. */
export function readSuite(path: string): { name: string; members: string[] } {
  const suite = RunnerSuite.parse(JSON.parse(readFileSync(path, "utf8")));
  const base = dirname(resolve(path));
  return { name: suite.name, members: suite.suite.map((m) => resolve(base, m)) };
}
