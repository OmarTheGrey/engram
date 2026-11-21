import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cellItem, keyedPreset, readMeritConfig, runCells } from "../../src/merit/config.ts";

const FIXTURE = fileURLToPath(
  new URL("../../../../research/configs/b7-merit-fixture.json", import.meta.url),
);

describe("MERIT run config", () => {
  it("expands the fixture config into C1 once and C2 and C5 on each store", () => {
    const config = readMeritConfig(FIXTURE);
    const cells = runCells(config);
    expect(cells.map((c) => c.name)).toEqual([
      "d1-easy__C1__none__s1",
      "d1-easy__C2__fake__s1",
      "d1-easy__C2__mem0__s1",
      "d1-easy__C2__letta__s1",
      "d1-easy__C5__fake__s1",
      "d1-easy__C5__mem0__s1",
      "d1-easy__C5__letta__s1",
    ]);
    expect(config.cassettes.replaceAll("\\", "/")).toMatch(
      /fixtures\/cassettes\/b7-merit-fixture$/,
    );
  });

  it("keys C1 and C2 under preset none and C5 under the config's preset, as the runner's statedPreset", () => {
    expect(keyedPreset("C1", "medium")).toBe("none");
    expect(keyedPreset("C2", "medium")).toBe("none");
    expect(keyedPreset("C5", "medium")).toBe("medium");
    const cells = runCells(readMeritConfig(FIXTURE));
    expect(new Set(cells.map((c) => `${c.condition}:${c.preset}`))).toEqual(
      new Set(["C1:none", "C2:none", "C5:medium"]),
    );
  });

  it("names a cell's item by domain and difficulty", () => {
    expect(cellItem({ domain: "d2", difficulty: "hard", arcs: 1, episodes: 5 })).toBe("d2-hard");
  });

  it("refuses a config that repeats a seed", () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-b7-config-"));
    const path = join(dir, "c.json");
    const config = JSON.parse(JSON.stringify(readMeritConfig(FIXTURE)));
    writeFileSync(path, JSON.stringify({ ...config, cassettes: "x", seeds: [1, 1] }));
    expect(() => readMeritConfig(path)).toThrow(/must not repeat/);
  });

  it("refuses two cells with the same item, which would share keys and folders", () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-b7-config-"));
    const path = join(dir, "c.json");
    const config = JSON.parse(JSON.stringify(readMeritConfig(FIXTURE)));
    const cell = { domain: "d1", difficulty: "easy", arcs: 1, episodes: 5 };
    writeFileSync(
      path,
      JSON.stringify({ ...config, cassettes: "x", cells: [cell, { ...cell, arcs: 3 }] }),
    );
    expect(() => readMeritConfig(path)).toThrow(/same domain and difficulty/);
  });

  it("refuses a condition the pre-registration does not run on MERIT", () => {
    const dir = mkdtempSync(join(tmpdir(), "engram-b7-config-"));
    const path = join(dir, "c.json");
    const config = JSON.parse(JSON.stringify(readMeritConfig(FIXTURE)));
    writeFileSync(path, JSON.stringify({ ...config, cassettes: "x", conditions: ["C3"] }));
    expect(() => readMeritConfig(path)).toThrow();
  });
});
