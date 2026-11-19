// Card L4: both lint tiers over card L2's seeded-fault set, through the
// runner. The deterministic floor (lintFaultStateDeterministic) flags exactly
// the keyed faults of the fixture-size set and records the units card L3's
// lints would send; the pipeline config (research/configs/h3-lint-model-
// fixture.json) replays its committed cassettes with zero new calls and the
// rows a recording from its script gives; the experiment config (the live run
// on the full set) runs only on a named model and on the set card L2's result
// pins, or is counted without a call.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { faults } from "@engram/bench";
import { memoryCache } from "@engram/model";
import { afterAll, describe, expect, test } from "vitest";
import {
  checkSetHashes,
  countFaultSetConfig,
  type FloorRow,
  lintFaultStateDeterministic,
  parseFaultSetConfig,
  readFaultSetConfig,
  readSetPolicy,
  readSetStates,
  runFaultSetConfig,
} from "../src/lint-fault-set.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const SET = join(REPO, "fixtures/fault-sets/longmemeval");
const FIXTURE = join(REPO, "research/configs/h3-lint-model-fixture.json");
const EXPERIMENT = join(REPO, "research/configs/h3-lint-model.json");
const L2_RESULT = join(REPO, "research/results/h3-fault-set.json");

const temp: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-l4-"));
  temp.push(dir);
  return dir;
};
afterAll(() => {
  for (const d of temp) rmSync(d, { recursive: true, force: true });
});

const labels = (): faults.FaultLabel[] =>
  readFileSync(join(SET, "labels.jsonl"), "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as faults.FaultLabel);

const runScript = (args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [join(REPO, "packages/runner/scripts/run.ts"), ...args], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

async function floor(): Promise<FloorRow[]> {
  const policy = readSetPolicy(SET);
  const rows: FloorRow[] = [];
  for await (const s of readSetStates(SET)) rows.push(await lintFaultStateDeterministic(s, policy));
  return rows;
}

describe("the deterministic floor over the fixture-size set", () => {
  test("flags exactly the keyed faults, by the lint each expects, and no near-miss or base item", async () => {
    const rows = await floor();
    expect(rows).toHaveLength(20);
    const expected = labels()
      .filter((l) => l.expected.deterministic.length > 0)
      .flatMap((l) =>
        l.expected.deterministic.map((lint) => `${l.question_id} ${lint} ${l.item_id}`),
      )
      .sort();
    const found = rows
      .flatMap((r) => r.findings.map((f) => `${r.question_id} ${f.lint_id} ${f.item_id}`))
      .sort();
    expect(found).toEqual(expected);
    expect(rows.every((r) => r.findings.every((f) => f.tier === "deterministic" && !f.base))).toBe(
      true,
    );
  });

  test("plans every labelled model unit, and the count of a config is the planned units times its seeds", async () => {
    const rows = await floor();
    const planned = new Set(
      rows.flatMap((r) => r.planned.map((u) => `${r.question_id} ${u.unit}`)),
    );
    for (const l of labels())
      for (const lint of [...l.expected.model, ...l.near_miss_of.model]) {
        const unit =
          lint === "contradiction"
            ? `contradiction:${[l.item_id, ...l.related].sort().join("+")}`
            : `${lint}:${l.item_id}`;
        expect(planned.has(`${l.question_id} ${unit}`)).toBe(true);
      }
    const config = readFaultSetConfig(FIXTURE);
    const count = await countFaultSetConfig(config, REPO);
    const mine = rows.filter((r) => (config.questions as string[]).includes(r.question_id));
    expect(count.per_seed).toBe(mine.reduce((n, r) => n + r.planned.length, 0));
    expect(count.calls).toBe(count.per_seed * 2);
    expect(count.request_chars).toBe(
      mine.reduce((n, r) => n + r.planned.reduce((m, u) => m + u.chars, 0), 0),
    );
    expect(count.data).toBe("fixtures/fault-sets/longmemeval");
  });
});

describe("the fault-set configs", () => {
  test("the pipeline config lints two states at seeds 1 and 2 on its scripted model", () => {
    expect(readFaultSetConfig(FIXTURE)).toMatchObject({
      kind: "pipeline",
      benchmark: "fault-set",
      model: "scripted/lint-l4",
      seeds: [1, 2],
      questions: ["66f24dbb", "3d86fd0a"],
    });
  });

  test("the experiment is every state of card L2's full set on the model slot M1 at seeds 1 to 3, pinned to its hashes", () => {
    const config = readFaultSetConfig(EXPERIMENT);
    expect(config).toMatchObject({
      kind: "experiment",
      model: "prereg/M1",
      seeds: [1, 2, 3],
      questions: "all",
    });
    expect(config.script).toBeUndefined();
    expect(config.data.replaceAll("\\", "/")).toMatch(/\/\.engram\/faults\/h3-fault-set$/);
    const committed = JSON.parse(readFileSync(L2_RESULT, "utf8")).set.sha256;
    expect(config.sha256).toEqual({
      "policy.json": committed["policy.json"],
      "states.jsonl": committed["states.jsonl"],
    });
  });

  test("an experiment on a script, or without pinned hashes, and a scripted model without a script, are refused", () => {
    const base = {
      name: "x",
      kind: "experiment",
      benchmark: "fault-set",
      data: ".",
      questions: "all",
      model: "prereg/M1",
      seeds: [1],
      cassettes: ".",
    };
    const pinned = { "policy.json": "0".repeat(64), "states.jsonl": "0".repeat(64) };
    expect(() => parseFaultSetConfig({ ...base, sha256: pinned })).not.toThrow();
    expect(() => parseFaultSetConfig(base)).toThrow(/sha256/);
    expect(() => parseFaultSetConfig({ ...base, sha256: pinned, script: "s.json" })).toThrow(
      /never a scripted one/,
    );
    expect(() =>
      parseFaultSetConfig({ ...base, kind: "pipeline", model: "scripted/lint-l4" }),
    ).toThrow(/needs a script/);
  });

  test("a set whose file differs from its pinned hash is refused before anything runs", async () => {
    const dir = scratch();
    copyFileSync(join(SET, "policy.json"), join(dir, "policy.json"));
    writeFileSync(join(dir, "states.jsonl"), "");
    const config = parseFaultSetConfig({
      name: "x",
      kind: "experiment",
      benchmark: "fault-set",
      data: dir,
      questions: "all",
      model: "prereg/M1",
      seeds: [1],
      cassettes: dir,
      sha256: { "policy.json": "0".repeat(64), "states.jsonl": "0".repeat(64) },
    });
    await expect(checkSetHashes(config)).rejects.toThrow(/differs from its pinned sha256/);
    await expect(countFaultSetConfig(config, REPO)).rejects.toThrow(/pinned sha256/);
    const gone = parseFaultSetConfig({ ...config, data: join(dir, "absent") });
    await expect(checkSetHashes(gone)).rejects.toThrow(/is missing/);
  });
});

describe("the pipeline replay", () => {
  test("makes zero new calls and gives the rows a recording from the script gives", async () => {
    const config = readFaultSetConfig(FIXTURE);
    const replay = await runFaultSetConfig(config, { offline: true });
    expect(replay.calls.new).toBe(0);
    expect(replay.calls.cached).toBe(250);
    const recorded = await runFaultSetConfig(config, { cache: memoryCache(), offline: false });
    expect(recorded.calls).toEqual({ new: 250, cached: 0 });
    expect(replay.rows).toEqual(recorded.rows);
    expect(replay.summary).toEqual({
      "1": { flag: 5, pass: 120, refused: 0, malformed: 0 },
      "2": { flag: 6, pass: 117, refused: 1, malformed: 1 },
    });
  });

  test("each row holds both tiers: the deterministic findings of the floor and the model's", async () => {
    const config = readFaultSetConfig(FIXTURE);
    const { rows } = await runFaultSetConfig(config, { offline: true });
    const det = new Map((await floor()).map((r) => [r.question_id, r]));
    for (const r of rows) {
      const tiers = new Set(r.findings.map((f) => f.tier));
      expect(tiers).toEqual(new Set(["deterministic", "model"]));
      expect(r.findings.filter((f) => f.tier === "deterministic")).toEqual(
        det.get(r.question_id)?.findings,
      );
      expect(r.judgments.map((j) => j.unit)).toEqual(
        det.get(r.question_id)?.planned.map((u) => u.unit),
      );
    }
  });

  test("run.ts counts the experiment's states, and refuses to run it without a named model", () => {
    const out = scratch();
    const refused = runScript(["--config", EXPERIMENT, "--out", out], { ENGRAM_OFFLINE: "1" });
    expect(refused.status).toBe(2);
    expect(refused.stderr).toMatch(/experiment config/);
    const counted = runScript(["--config", FIXTURE, "--out", out, "--count"]);
    expect(counted.status).toBe(0);
    expect(counted.stdout).toMatch(/calls: 250 = 125 per seed x 2 seeds/);
    expect(counted.stdout).toMatch(/no model was called/);
  });
});
