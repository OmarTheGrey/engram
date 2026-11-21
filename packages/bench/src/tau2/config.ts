// tau2-bench's run config (card B11): which pinned tasks run under which
// conditions, seeds and models, and where the cassettes are. Paths in the
// file are relative to it, as the runner's configs are.
//
// The conditions follow the runner's definitions, which this package may not
// import (the runner imports @engram/bench): CONDITION_TABLE, statedPreset and
// usesStore in packages/runner/src/config.ts, and the condition comment in
// packages/runner/src/conditions.ts.
//
// - C1, no memory: tau2's own agent (`llm_agent`), no memory tool. The
//   runner's C1 holds the benchmark's long context in the prompt; tau2 has
//   none beyond its conversation, so C1 is tau2 unchanged.
// - C2, ungoverned: the memory tools over the store with no plane (the
//   runner's ungovernedMemoryTools and ungovernedRead).
// - C5, enforced: the same tools through the plane, at the config's preset,
//   over `engram serve`.
//
// Only these three are offered: they are H5's (docs/research/preregistration.md).
// The key names the preset only where the condition enforces it (C5) and the
// store only where the condition opens one (C2, C5), as statedPreset and
// NO_STORE do, so a preset sweep never pays for C1 or C2 again.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";

/** The pin of packages/bench/PINS.md: tag v1.0.1. */
export const TAU2_PIN = {
  repository: "https://github.com/sierra-research/tau2-bench",
  tag: "v1.0.1",
  commit: "fc0055dc4e0a316c3f83133267fbd6faaa770992",
} as const;

/** The harness name the proxy qualifies every item with (card B10). */
export const TAU2_HARNESS = "tau2";

export const TAU2_CONDITIONS = ["C1", "C2", "C5"] as const;
export type Tau2Condition = (typeof TAU2_CONDITIONS)[number];

/** How each condition reaches memory: the runner's CONDITION_TABLE, restricted to H5's three. */
export const TAU2_MEMORY: Readonly<Record<Tau2Condition, "none" | "store" | "plane">> = {
  C1: "none",
  C2: "store",
  C5: "plane",
};

/** The runner's statedPreset: the preset only where the condition enforces it. */
export const keyPreset = (condition: Tau2Condition, preset: string) =>
  TAU2_MEMORY[condition] === "plane" ? preset : "none";

/** The runner's NO_STORE: C1 opens no store. */
export const keyStore = (condition: Tau2Condition, store: string) =>
  TAU2_MEMORY[condition] === "none" ? "none" : store;

const unique = <T>(values: readonly T[]) => new Set(values).size === values.length;

/** `provider/model-id`; the proxy sees what LiteLLM sends, which is this without `openai/`. */
const ModelId = z.string().regex(/^[^/\s]+\/\S+$/, "model must be provider/model-id");

export const Tau2Config = z.strictObject({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  /** `pipeline` checks the harness on fixtures with a scripted model; its numbers are not results. */
  kind: z.literal("pipeline"),
  benchmark: z.literal("tau2"),
  pin: z.strictObject({
    repository: z.literal(TAU2_PIN.repository),
    tag: z.literal(TAU2_PIN.tag),
    commit: z.literal(TAU2_PIN.commit),
  }),
  domain: z.enum(["airline", "retail"]),
  /** tau2's split the tasks are drawn from (split_tasks.json); every task must be in it. */
  split: z.enum(["train", "test", "base"]),
  tasks: z.array(z.string().min(1)).min(1).refine(unique, "tasks must be unique"),
  conditions: z.array(z.enum(TAU2_CONDITIONS)).min(1).refine(unique, "conditions must be unique"),
  seeds: z.array(z.number().int().nonnegative()).min(1).refine(unique, "seeds must be unique"),
  preset: z.enum(["strict", "medium", "permissive"]),
  /** The store C2 and C5 write to: the files store, the one `engram serve` and the adapters share. */
  store: z.literal("files"),
  /** The runner's READ_LIMIT: how many items a read returns in every condition. */
  read_limit: z.number().int().positive(),
  agent_model: ModelId,
  user_model: ModelId,
  temperature: z.number().min(0),
  max_steps: z.number().int().positive(),
  max_errors: z.number().int().positive(),
  /** How long one tau2 process, one (condition, seed), may run before it is stopped. */
  timeout_s: z.number().int().positive(),
  /** The time every memory item is dated: tau2's own clock for the domain, so nothing reads the wall clock. */
  memory_time: z.iso.datetime(),
  /** The scripted upstream's replies; only scripted models are wired (no live model before card X11). */
  script: z.string().optional(),
  cassettes: z.string(),
  /**
   * The results.jsonl the slice must reproduce, byte for byte: written by
   * `--record` (make fixtures), compared on every other run, so a change to
   * a reward or a step count fails the acceptance (review B11-4).
   */
  expected: z.string().optional(),
});
export type Tau2Config = z.infer<typeof Tau2Config>;

/** A config read from disk, its paths resolved against the file's folder. */
export function readTau2Config(path: string): Tau2Config {
  const config = Tau2Config.parse(JSON.parse(readFileSync(path, "utf8")));
  const base = dirname(resolve(path));
  return {
    ...config,
    cassettes: resolve(base, config.cassettes),
    ...(config.expected === undefined ? {} : { expected: resolve(base, config.expected) }),
    ...(config.script === undefined ? {} : { script: resolve(base, config.script) }),
  };
}

/** Whether a config's model id names the scripted upstream (`scripted/...`). */
export const isScriptedModel = (model: string) => model.startsWith("scripted/");

/** The item a task's calls are keyed under: `<domain>/<task>/<role>`, the harness added by the proxy. */
export const taskItem = (domain: string, task: string, role: "agent" | "user" | "judge") =>
  `${domain}/${task}/${role}`;
