// The runner config (card RN1): which benchmark items run, under which
// conditions (docs/research/preregistration.md, C1 to C7), with which model,
// seeds, policy preset and store. Every seed comes from here (AGENTS.md rule
// 6) and every cache key part besides the prompt does too (rule 7, ADR 0017).
// Paths are relative to the config file, as in the B1 run config.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PRESETS } from "@engram/core";
import { z } from "zod";

/**
 * The conditions this runner builds. C1, C4, C6 and C7 are not built yet: C1
 * and C4 are GateMem's own long-context and RAG-Policy agents (card B1 has
 * the first), C6 needs the lint cards and C7 the MCP server.
 */
export const CONDITIONS = ["C2", "C3", "C5"] as const;
export const Condition = z.enum(CONDITIONS);
export type Condition = z.infer<typeof Condition>;

/** What each condition is, in the pre-registration's words. */
export const CONDITION_NAMES: Readonly<Record<Condition, string>> = {
  C2: "ungoverned",
  C3: "instruction",
  C5: "enforced",
};

export const STORES = ["fake"] as const;

const unique = <T>(values: readonly T[]) => new Set(values).size === values.length;

export const RunnerConfig = z.strictObject({
  /** Names the run in results and cassettes. */
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  /**
   * `pipeline` checks the runner on fixtures with a scripted model; it is not
   * a registered experiment and its numbers are not results (AGENTS.md rule 9).
   */
  kind: z.literal("pipeline"),
  benchmark: z.literal("gatemem"),
  /** GateMem data root, one directory per domain. */
  data: z.string(),
  /** Checkpoint ids. */
  items: z.array(z.string().min(1)).min(1).refine(unique, "items must be unique"),
  conditions: z.array(Condition).min(1).refine(unique, "conditions must be unique"),
  /** `provider/model-id`. `scripted/<id>` answers misses from `script`. */
  model: z.string().regex(/^[^/\s]+\/\S+$/, "model must be provider/model-id"),
  seeds: z.array(z.number().int()).min(1).refine(unique, "seeds must be unique"),
  /** The policy preset C3 states and C5 enforces. */
  preset: z.enum(PRESETS),
  store: z.enum(STORES),
  /** The scripted model's steps by checkpoint id. Required for a scripted model. */
  script: z.string().optional(),
  /** The cassette directory (a fileCache). */
  cassettes: z.string(),
});
export type RunnerConfig = z.infer<typeof RunnerConfig>;

export function parseRunnerConfig(value: unknown, base = process.cwd()): RunnerConfig {
  const config = RunnerConfig.parse(value);
  if (config.model.startsWith("scripted/") && config.script === undefined) {
    throw new Error(`config ${config.name}: a scripted model needs a script`);
  }
  return {
    ...config,
    data: resolve(base, config.data),
    cassettes: resolve(base, config.cassettes),
    ...(config.script === undefined ? {} : { script: resolve(base, config.script) }),
  };
}

/** Read a config file; its paths are resolved against the file's directory. */
export function readRunnerConfig(path: string): RunnerConfig {
  return parseRunnerConfig(JSON.parse(readFileSync(path, "utf8")), dirname(resolve(path)));
}
