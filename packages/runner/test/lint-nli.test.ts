// Card L7: the NLI tier through the runners. Both fixture configs replay
// their committed model cassettes and NLI score cassettes with zero new calls
// and zero new scores; the band's model calls are a subset of the model
// tier's own; a config without an `nli` block writes what it wrote before;
// and a scripted scorer (no runtime, no network) records into a memory cache.
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { memoryNliCache, NliMissError, scriptedNliScore } from "@engram/model";
import { describe, expect, test } from "vitest";
import { readFaultSetConfig, readSetPolicy, runFaultSetConfig } from "../src/lint-fault-set.ts";
import { readLintConfig, runLintConfig, withNliTier } from "../src/lint-faults.ts";

const REPO = resolve(import.meta.dirname, "../../..");

/**
 * Runs `fn` with ENGRAM_OFFLINE set to `value` (unset when undefined), then
 * restores it. CI sets ENGRAM_OFFLINE=1; a test of the fetch or recording path
 * with a fake fetch or a scripted scorer clears it, and a test of the guard
 * sets it (review of card L7, the offline failure).
 */
async function withOffline<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const before = process.env.ENGRAM_OFFLINE;
  if (value === undefined) delete process.env.ENGRAM_OFFLINE;
  else process.env.ENGRAM_OFFLINE = value;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env.ENGRAM_OFFLINE;
    else process.env.ENGRAM_OFFLINE = before;
  }
}

const config = (name: string) => join(REPO, "research/configs", `${name}.json`);

describe("the fault-set fixture with the tier (h3-lint-nli-fixture)", () => {
  test("replays with zero new calls and zero new scores; only the band reaches the model", async () => {
    const tiered = await runFaultSetConfig(readFaultSetConfig(config("h3-lint-nli-fixture")), {
      offline: true,
    });
    const model = await runFaultSetConfig(readFaultSetConfig(config("h3-lint-model-fixture")), {
      offline: true,
    });
    expect(tiered.calls.new).toBe(0);
    expect(tiered.scores).toEqual({ new: 0, cached: 452 });
    const keys = new Set(model.usage.map((u) => u.key));
    expect(tiered.usage.every((u) => keys.has(u.key))).toBe(true);
    for (const [m, t] of model.rows.map((r, i) => [r, tiered.rows[i]] as const)) {
      const contradiction = (rows: typeof m.judgments) =>
        rows.filter((j) => j.lint_id === "contradiction").map((j) => j.unit);
      expect(t?.nli?.map((j) => j.unit)).toEqual(contradiction(m.judgments));
      expect(contradiction(t?.judgments ?? [])).toEqual(
        (t?.nli ?? []).filter((j) => j.band === "model").map((j) => j.unit),
      );
      expect(t?.judgments.filter((j) => j.lint_id !== "contradiction")).toEqual(
        m.judgments.filter((j) => j.lint_id !== "contradiction"),
      );
    }
  });

  test("without a scorer, a score the cassettes miss is an error", async () => {
    const c = readFaultSetConfig(config("h3-lint-nli-fixture"));
    await expect(
      runFaultSetConfig(c, { offline: true, nliCache: memoryNliCache() }),
    ).rejects.toBeInstanceOf(NliMissError);
  });

  test("a scripted scorer records every pair once into the cache it is given", async () => {
    const c = readFaultSetConfig(config("h3-lint-nli-fixture"));
    if (c.nli === undefined) throw new Error("h3-lint-nli-fixture has no nli block");
    const scripted = { ...c, nli: { ...c.nli, model: "scripted/nli-1" } };
    const cache = memoryNliCache();
    // Recording is refused under ENGRAM_OFFLINE=1, which CI sets: cleared here,
    // as the scorer is scripted and nothing reaches the network.
    const run = await withOffline(undefined, () =>
      runFaultSetConfig(scripted, {
        offline: true,
        nliCache: cache,
        nliScore: scriptedNliScore("scripted/nli-1", () => [0, 0, 5]),
      }),
    );
    // Two seeds of the same pairs: the first scores them, the second reads them back.
    expect(run.scores?.new).toBe(run.scores?.cached);
    expect(run.rows.flatMap((r) => r.nli ?? []).every((j) => j.band === "drop")).toBe(true);
    expect(run.rows.flatMap((r) => r.judgments).every((j) => j.lint_id !== "contradiction")).toBe(
      true,
    );
  });
});

describe("recording under ENGRAM_OFFLINE=1", () => {
  test("a scorer given to the run records nothing: a miss is an error and the scorer is never asked", async () => {
    const c = readFaultSetConfig(config("h3-lint-nli-fixture"));
    if (c.nli === undefined) throw new Error("h3-lint-nli-fixture has no nli block");
    const scripted = { ...c, nli: { ...c.nli, model: "scripted/nli-1" } };
    let asked = 0;
    const score = scriptedNliScore("scripted/nli-1", () => {
      asked++;
      return [0, 0, 5];
    });
    const cache = memoryNliCache();
    await withOffline("1", () =>
      expect(
        runFaultSetConfig(scripted, { offline: true, nliCache: cache, nliScore: score }),
      ).rejects.toBeInstanceOf(NliMissError),
    );
    expect(asked).toBe(0);
  });
});

describe("card L3's contradiction fixtures with the tier (l3-lint-nli-fixture)", () => {
  test("replay with zero new calls and zero new scores", async () => {
    const run = await runLintConfig(readLintConfig(config("l3-lint-nli-fixture")), {
      offline: true,
    });
    expect(run.calls.new).toBe(0);
    expect(run.scores).toEqual({ new: 0, cached: 72 });
    expect(run.rows.every((r) => (r.nli ?? []).length === r.labels.units.length)).toBe(true);
  });

  test("a config without an nli block writes rows and usage without the tier's fields", async () => {
    const run = await runLintConfig(readLintConfig(config("l3-lint-fixture")), { offline: true });
    expect(run.scores).toBeUndefined();
    expect(run.rows.some((r) => "nli" in r)).toBe(false);
  });
});

describe("withNliTier", () => {
  test("keeps the policy's id and everything else, and adds the id and the thresholds once", () => {
    const policy = readSetPolicy(join(REPO, "fixtures/fault-sets/longmemeval"));
    const t = withNliTier(policy, { thresholds: { upper: 1, lower: 0.1 } });
    expect(t.id).toBe(policy.id);
    expect(t.write).toEqual(policy.write);
    expect(t.lints.enabled).toEqual([...policy.lints.enabled, "contradiction-nli"]);
    expect(t.lints.thresholds).toMatchObject({
      "contradiction-nli.upper": 1,
      "contradiction-nli.lower": 0.1,
    });
    expect(withNliTier(t, { thresholds: { upper: 1, lower: 0.1 } }).lints.enabled).toEqual(
      t.lints.enabled,
    );
  });
});

describe("run.ts --record-nli", () => {
  test("goes alone: refused with --count", () => {
    const run = spawnSync(
      process.execPath,
      [
        join(REPO, "packages/runner/scripts/run.ts"),
        "--config",
        config("h3-lint-nli-fixture"),
        "--out",
        join(REPO, ".engram/runs/never"),
        "--record-nli",
        "--count",
      ],
      { encoding: "utf8" },
    );
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/--record-nli records NLI scores/);
  });
});
