// The runner config (card RN1): the example pipeline config validates and its
// paths resolve against the config file; malformed configs are rejected.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { configStores, parseRunnerConfig, readRunnerConfig } from "../src/config.ts";
import { B3, EXAMPLE } from "./paths.ts";

const valid = {
  name: "t",
  kind: "pipeline",
  benchmark: "gatemem",
  data: "data",
  items: ["ckpt"],
  conditions: ["C2", "C3", "C5"],
  model: "scripted/scripted-1",
  seeds: [1],
  preset: "medium",
  store: "fake",
  script: "script.json",
  cassettes: "cassettes",
};

describe("runner config", () => {
  test("the example config validates and names existing data, script and cassettes", () => {
    const config = readRunnerConfig(EXAMPLE);
    expect(config.conditions).toEqual(["C2", "C3", "C5"]);
    expect(config.preset).toBe("medium");
    expect(config.kind).toBe("pipeline");
    expect(existsSync(join(config.data, "medical", "checkpoints.jsonl"))).toBe(true);
    expect(existsSync(config.script as string)).toBe(true);
    expect(existsSync(config.cassettes)).toBe(true);
  });

  test("resolves paths against the base directory", () => {
    const config = parseRunnerConfig(valid, "/base");
    expect(config.data.replaceAll("\\", "/")).toMatch(/\/base\/data$/);
    expect(config.cassettes.replaceAll("\\", "/")).toMatch(/\/base\/cassettes$/);
  });

  test.each([
    ["an unknown condition", { conditions: ["C9"] }],
    ["a condition twice", { conditions: ["C2", "C2"] }],
    ["no seeds", { seeds: [] }],
    ["a fractional seed", { seeds: [1.5] }],
    ["an unknown preset", { preset: "lenient" }],
    ["a model without a provider", { model: "scripted-1" }],
    ["an unknown field", { temperature: 0.2 }],
    ["a registered-experiment kind", { kind: "experiment" }],
    ["an unknown store", { store: "redis" }],
    ["an empty store list", { store: [] }],
    ["a store twice", { store: ["fake", "fake"] }],
  ])("rejects %s", (_name, change) => {
    expect(() => parseRunnerConfig({ ...valid, ...change })).toThrow();
  });

  test("a config names one store or several (card B3)", () => {
    expect(configStores(parseRunnerConfig(valid))).toEqual(["fake"]);
    expect(configStores(parseRunnerConfig({ ...valid, store: ["mem0", "fake"] }))).toEqual([
      "mem0",
      "fake",
    ]);
    expect(configStores(readRunnerConfig(B3))).toEqual(["fake", "mem0"]);
  });

  test("a scripted model without a script is rejected", () => {
    const { script: _script, ...rest } = valid;
    expect(() => parseRunnerConfig(rest)).toThrow(/needs a script/);
  });
});
