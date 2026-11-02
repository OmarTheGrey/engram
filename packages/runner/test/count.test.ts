// Plan decision 6: H1's full-size configs, and `make run CONFIG=<file>
// COUNT=1`, which checks a config's data against the pinned hashes and counts
// its sessions per condition, store and seed without calling a model or
// touching a cassette. An experiment config runs only live, as a replay of a
// live run, or counted.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gatemem } from "@engram/bench";
import { afterAll, describe, expect, test } from "vitest";
import { parseRunnerConfig, readRunnerConfig } from "../src/config.ts";
import { countConfig, countLines, UnpinnedData } from "../src/count.ts";
import { parseMemInvConfig, readMemInvConfig } from "../src/mem-inv-probe.ts";
import { H1_GATEMEM, H1_MEM_INV, X1_GATEMEM, X1_MEM_INV } from "./paths.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const temp: string[] = [];
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-count-"));
  temp.push(dir);
  return dir;
};
afterAll(() => {
  for (const d of temp) rmSync(d, { recursive: true, force: true });
});

const runScript = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [join(REPO, "packages/runner/scripts/run.ts"), ...args], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

describe("H1's configs (plan decision 6)", () => {
  test("h1-gatemem: every checkpoint of the pinned full set, C2 to C5, seeds 1 to 3, preset medium, on the placeholder store", () => {
    const config = readRunnerConfig(H1_GATEMEM);
    expect(config).toMatchObject({
      kind: "experiment",
      benchmark: "gatemem",
      items: "all",
      conditions: ["C2", "C3", "C4", "C5"],
      model: "prereg/M1",
      seeds: [1, 2, 3],
      preset: "medium",
      store: "fake",
    });
    expect(config.data.replaceAll("\\", "/")).toMatch(/\.engram\/upstream\/gatemem\/bench\/data$/);
    expect(config.script).toBeUndefined();
  });

  test("h1-mem-inv: the full case set, 456 sessions, counted with no cassette touched", async () => {
    const config = readMemInvConfig(H1_MEM_INV);
    const cassettes = join(fresh(), "never");
    const count = await countConfig({ ...config, cassettes });
    expect(count.data).toMatchObject({ set: "full", commit: expect.stringMatching(/^cf3c9a4/) });
    expect(count.items).toBe(38);
    expect(count.item_kinds).toEqual({
      "attack/corroborate": 8,
      "attack/direct": 8,
      "attack/summarize": 8,
      "attack/tool_echo": 8,
      benign: 6,
    });
    expect(count.sessions).toBe(38 * 4 * 3);
    expect(count.per_condition).toEqual({ C2: 114, C3: 114, C4: 114, C5: 114 });
    expect(count.cells).toHaveLength(4 * 3);
    expect(existsSync(cassettes)).toBe(false);
    expect(countLines(count).at(-1)).toBe("no model was called; no cassette was read or written");
  });

  test("h1-gatemem counts 26,616 sessions on the pinned full set; without it, it is refused unless fetched", async () => {
    const config = readRunnerConfig(H1_GATEMEM);
    if (gatemem.checkGateMemData(config.data).set === "full") {
      const count = await countConfig(config);
      expect(count.items).toBe(2218);
      expect(count.item_kinds).toEqual({
        "access control": 727,
        "active forgetting": 763,
        utility: 728,
      });
      expect(count.sessions).toBe(2218 * 4 * 3);
    } else {
      // The pinned data is fetched only with `fetch` (COUNT=1 passes it); a test never does.
      await expect(countConfig(config)).rejects.toThrow(UnpinnedData);
    }
  }, 120_000);
});

describe("COUNT on fixture configs", () => {
  test("x1-h1-gatemem: C1 runs once with no store, every other condition on the store", async () => {
    const count = await countConfig(readRunnerConfig(X1_GATEMEM));
    expect(count.data.set).toBe("fixture");
    expect(count.cells.map((c) => `${c.condition}@${c.store}#${c.seed}`)).toEqual([
      "C1@none#1",
      "C1@none#2",
      "C2@fake#1",
      "C2@fake#2",
      "C3@fake#1",
      "C3@fake#2",
      "C4@fake#1",
      "C4@fake#2",
      "C5@fake#1",
      "C5@fake#2",
    ]);
    expect(count.sessions).toBe(20);
  });

  test("x1-h1-mem-inv: every condition on every store", async () => {
    const count = await countConfig(readMemInvConfig(X1_MEM_INV));
    expect(count.sessions).toBe(2 * 4 * 3);
    expect(count.stores).toEqual(["fake", "mem0", "letta"]);
  });

  test("C1 on several stores still runs once per item and seed", async () => {
    const raw = JSON.parse(readFileSync(X1_GATEMEM, "utf8"));
    const config = parseRunnerConfig(
      { ...raw, store: ["fake", "mem0"] },
      join(REPO, "research/configs"),
    );
    const count = await countConfig(config);
    expect(count.per_condition).toEqual({ C1: 4, C2: 8, C3: 8, C4: 8, C5: 8 });
  });

  test("a case directory one line short of the pin is refused", async () => {
    const config = readMemInvConfig(H1_MEM_INV);
    const dir = fresh();
    cpSync(config.data, dir, { recursive: true });
    const lines = readFileSync(join(dir, "cases.jsonl"), "utf8").split("\n");
    writeFileSync(join(dir, "cases.jsonl"), lines.slice(1).join("\n"));
    await expect(countConfig({ ...config, data: dir })).rejects.toThrow(UnpinnedData);
    // A pipeline config takes the fixture subset; an experiment takes only the full set.
    const subset = { ...config, data: join(REPO, "fixtures/bench/mem-inv-bench") };
    await expect(countConfig(subset)).rejects.toThrow(/pinned full set/);
    await expect(countConfig({ ...subset, kind: "pipeline" })).resolves.toMatchObject({
      items: 24,
    });
  });
});

describe("an experiment config runs only live, replayed, or counted", () => {
  test("a scripted model or a script is refused", () => {
    const raw = JSON.parse(readFileSync(H1_MEM_INV, "utf8"));
    expect(() =>
      parseMemInvConfig({ ...raw, model: "scripted/scripted-1", script: "s.json" }),
    ).toThrow(/live model/);
  });

  test("the command refuses a plain run and a recording of it", () => {
    const out = join(fresh(), "out");
    const plain = runScript(["--config", H1_MEM_INV, "--out", out], { ENGRAM_OFFLINE: "1" });
    expect(plain.status).toBe(2);
    expect(plain.stderr).toMatch(/experiment config/);
    const record = runScript(["--config", H1_MEM_INV, "--out", out, "--record"], {
      ENGRAM_OFFLINE: "",
    });
    expect(record.status).toBe(2);
    expect(existsSync(out)).toBe(false);
  }, 30_000);

  test("a live run of a GateMem experiment whose data is missing, under ENGRAM_OFFLINE=1, is refused before it fetches or creates anything (P3-6)", () => {
    const dir = fresh();
    const data = join(dir, "data");
    mkdirSync(data);
    const raw = JSON.parse(readFileSync(H1_GATEMEM, "utf8"));
    const config = join(dir, "h1-missing-data.json");
    writeFileSync(
      config,
      JSON.stringify({ ...raw, name: "h1-missing-data", data, cassettes: join(dir, "cassettes") }),
    );
    const out = join(dir, "out");
    const cassettes = join(dir, "live-cassettes");
    const run = runScript(
      [
        "--config",
        config,
        "--out",
        out,
        "--live",
        "--model",
        "faux-live/model-1",
        "--cassettes",
        cassettes,
      ],
      { ENGRAM_OFFLINE: "1" },
    );
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/live run refused: ENGRAM_OFFLINE=1/);
    expect(run.stdout).not.toMatch(/fetched/);
    expect(readdirSync(data)).toEqual([]);
    expect(existsSync(out)).toBe(false);
    expect(existsSync(cassettes)).toBe(false);
  }, 30_000);

  test("the command counts it, writing count.json and nothing else", () => {
    const out = join(fresh(), "out");
    const run = runScript(["--config", H1_MEM_INV, "--out", out, "--count"], {
      ENGRAM_OFFLINE: "1",
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("sessions: 456 = 38 items");
    expect(run.stdout).toContain("no model was called; no cassette was read or written");
    const count = JSON.parse(readFileSync(join(out, "count.json"), "utf8"));
    expect(count.data.dir).toBe("fixtures/bench/mem-inv-bench/full");
    expect(existsSync(join(REPO, ".engram/runs/h1-mem-inv/cassettes"))).toBe(false);
  }, 30_000);
});
