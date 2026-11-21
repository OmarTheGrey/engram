// MERIT's pinned harness end to end through the proxy and the seam. It needs
// the checkout at the pin and MERIT's own environment under .engram/, which
// `make bench BENCH=merit` (or run-merit.ts --prepare) fetches and installs
// once; without them these tests are skipped and say why, since no test may
// reach the network (testing.md). The acceptance command runs the same path.
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fileCache, memoryCache } from "@engram/model";
import { describe, expect, it } from "vitest";
import { readMeritConfig } from "../../src/merit/config.ts";
import { MERIT_ENV_DIR, MERIT_UPSTREAM_DIR, meritPython } from "../../src/merit/env.ts";
import { MeritRunError, runMerit } from "../../src/merit/launch.ts";
import { summarise } from "../../src/merit/summary.ts";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const CHECKOUT = join(REPO, MERIT_UPSTREAM_DIR);
const PYTHON = meritPython(join(REPO, MERIT_ENV_DIR));
const SHIM = join(REPO, "packages/bench/scripts/merit-shim.py");
const CONFIG = join(REPO, "research/configs/b7-merit-fixture.json");
const ready = existsSync(join(CHECKOUT, "merit", "runner.py")) && existsSync(PYTHON);
if (!ready) {
  console.warn(
    `merit launch tests skipped: no MERIT checkout at ${CHECKOUT} or environment at ${PYTHON}; run make bench BENCH=merit once`,
  );
}

const replayOnly = (dir: string) => {
  const files = fileCache(dir);
  return {
    get: files.get,
    set: () => {
      throw new Error("a replay writes no cassette");
    },
  };
};

describe.runIf(ready)("MERIT through the proxy and the plane", () => {
  it("replays the fixture slice from the committed cassettes with zero new calls", async () => {
    const config = readMeritConfig(CONFIG);
    const result = await runMerit({
      config,
      out: mkdtempSync(join(tmpdir(), "engram-b7-")),
      checkout: CHECKOUT,
      python: PYTHON,
      shim: SHIM,
      cache: replayOnly(config.cassettes),
      env: { ...process.env, ENGRAM_OFFLINE: "1" },
    });
    const summary = summarise(result, {
      name: config.name,
      model: config.model,
      checkout: CHECKOUT,
    });
    expect(summary.calls.new).toBe(0);
    expect(summary.calls.from_cassettes).toBeGreaterThan(0);
    expect(summary.cells.map((c) => c.tasks.episodes)).toEqual([10, 10, 10, 10, 10, 10, 10]);
    for (const cell of summary.cells) {
      expect(cell.reference?.episodes_mismatched).toEqual([]);
      if (cell.condition === "C5") {
        expect(cell.plane?.write_allow).toBeGreaterThan(0);
        expect(cell.plane?.read_allow).toBe(cell.tasks.episodes);
        expect(cell.plane?.every_event_has_reason_and_policy).toBe(true);
      } else {
        expect(cell.plane).toBeNull();
      }
    }
  }, 600_000);

  it("fails the run on a cassette miss instead of calling a model", async () => {
    const config = { ...readMeritConfig(CONFIG), conditions: ["C1" as const] };
    const run = runMerit({
      config,
      out: mkdtempSync(join(tmpdir(), "engram-b7-")),
      checkout: CHECKOUT,
      python: PYTHON,
      shim: SHIM,
      cache: memoryCache(),
      env: { ...process.env, ENGRAM_OFFLINE: "1" },
    });
    await expect(run).rejects.toThrow(MeritRunError);
    await expect(run).rejects.toThrow(/cassette_miss/);
  }, 600_000);
});
