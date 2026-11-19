// Card B6, the engineering half: LongMemEval's ungoverned (C2) and enforced
// (C5, preset medium) baselines on the cleaned S split, as experiment configs
// that run only live, replayed, or counted, as H1's do; and a fixture-size
// config that replays B5's committed cassettes with zero new calls. pi-ai's
// faux provider stands in for a live reader and a live judge; nothing here
// reaches the network.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  createModels,
  type FauxResponseFactory,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import { longMemEval } from "@engram/bench";
import { afterAll, describe, expect, test } from "vitest";
import { countConfig, countLines, UnpinnedData } from "../src/count.ts";
import { liveConfig, liveOptions, replayConfig, replayOptions } from "../src/live.ts";
import { readLongMemEvalConfig, runLongMemEvalConfig } from "../src/longmemeval-probe.ts";
import { B6_FIXTURE, H2_LONGMEMEVAL_C2, H2_LONGMEMEVAL_C5 } from "./paths.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const FIXTURE_DATA = join(REPO, "fixtures/bench/longmemeval");
const temp: string[] = [];
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-b6-"));
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

describe("B6's experiment configs", () => {
  test("C2 and C5 at preset medium, every question of the pinned S split, M1, seeds 1 to 3, Mem0, the paper's judge through OpenRouter", () => {
    const c2 = readLongMemEvalConfig(H2_LONGMEMEVAL_C2);
    const c5 = readLongMemEvalConfig(H2_LONGMEMEVAL_C5);
    const shared = {
      kind: "experiment",
      benchmark: "longmemeval",
      items: "all",
      model: "prereg/M1",
      seeds: [1, 2, 3],
      preset: "medium",
      store: "mem0",
      read_limit: 20,
      judge: { model: "openrouter/openai/gpt-4o-2024-08-06", temperature: 0, max_tokens: 10 },
    };
    expect(c2).toMatchObject({ ...shared, conditions: ["C2"] });
    expect(c5).toMatchObject({ ...shared, conditions: ["C5"] });
    for (const c of [c2, c5]) {
      expect(c.data.replaceAll("\\", "/")).toMatch(
        /\.engram\/upstream\/longmemeval\/data\/longmemeval_s_cleaned\.json$/,
      );
      expect(c.script).toBeUndefined();
    }
    // They differ in their name, condition and cassettes only.
    const strip = ({ name, conditions, cassettes, ...rest }: typeof c2) => rest;
    expect(strip(c2)).toEqual(strip(c5));
  });

  test("each counts 1,500 sessions and 1,500 judge calls on the pinned S split; without it, it is refused", async () => {
    for (const path of [H2_LONGMEMEVAL_C2, H2_LONGMEMEVAL_C5]) {
      const config = readLongMemEvalConfig(path);
      const cassettes = join(fresh(), "never");
      if (longMemEval.checkLongMemEvalData(config.data).set === "full") {
        const count = await countConfig({ ...config, cassettes });
        expect(count.data.set).toBe("full");
        expect(count.items).toBe(500);
        expect(Object.values(count.item_kinds).reduce((a, b) => a + b, 0)).toBe(500);
        expect(count.sessions).toBe(1500);
        expect(count.judge).toEqual({
          model: "openrouter/openai/gpt-4o-2024-08-06",
          calls_min: 1500,
          calls_max: 1500,
        });
        expect(existsSync(cassettes)).toBe(false);
      } else {
        await expect(countConfig({ ...config, cassettes })).rejects.toThrow(
          /h2_longmemeval_ttl\.py --fetch-only/,
        );
      }
    }
  }, 120_000);

  test("an experiment config without a judge is refused at load, naming the seeded OpenRouter judge (review P6-5)", () => {
    const raw = JSON.parse(readFileSync(H2_LONGMEMEVAL_C5, "utf8"));
    delete raw.judge;
    const file = join(fresh(), "no-judge.json");
    writeFileSync(file, JSON.stringify(raw));
    expect(() => readLongMemEvalConfig(file)).toThrow(
      /an experiment on LongMemEval names its judge.*openrouter\/openai\/gpt-4o-2024-08-06/,
    );
    const out = join(fresh(), "out");
    const run = runScript(["--config", file, "--out", out, "--count"], { ENGRAM_OFFLINE: "1" });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/names its judge/);
    expect(existsSync(out)).toBe(false);
  }, 30_000);

  test("an experiment on the fixture subset is refused: it takes only the pinned S split", async () => {
    const config = { ...readLongMemEvalConfig(H2_LONGMEMEVAL_C5), data: FIXTURE_DATA };
    await expect(countConfig(config)).rejects.toThrow(UnpinnedData);
    await expect(countConfig(config)).rejects.toThrow(/pinned full set/);
  });

  test("a data file that is not the pinned S split is refused", async () => {
    const file = join(fresh(), "longmemeval_s_cleaned.json");
    writeFileSync(file, "[]");
    const config = { ...readLongMemEvalConfig(H2_LONGMEMEVAL_C2), data: file };
    await expect(countConfig(config)).rejects.toThrow(UnpinnedData);
  });

  test("the command refuses a plain run and a recording of it", () => {
    const out = join(fresh(), "out");
    const plain = runScript(["--config", H2_LONGMEMEVAL_C5, "--out", out], {
      ENGRAM_OFFLINE: "1",
    });
    expect(plain.status).toBe(2);
    expect(plain.stderr).toMatch(/experiment config/);
    const record = runScript(["--config", H2_LONGMEMEVAL_C5, "--out", out, "--record"], {
      ENGRAM_OFFLINE: "",
    });
    expect(record.status).toBe(2);
    expect(existsSync(out)).toBe(false);
  }, 30_000);

  test("the command refuses a live run under ENGRAM_OFFLINE=1 before it creates anything", () => {
    const out = join(fresh(), "out");
    const cassettes = join(fresh(), "live");
    const run = runScript(
      [
        "--config",
        H2_LONGMEMEVAL_C2,
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
    expect(existsSync(out)).toBe(false);
    expect(existsSync(cassettes)).toBe(false);
  }, 30_000);
});

describe("b6-longmemeval-fixture", () => {
  test("is the experiment's shape at fixture size: C2 and C5, preset medium, Mem0, read limit 20", () => {
    expect(readLongMemEvalConfig(B6_FIXTURE)).toMatchObject({
      kind: "pipeline",
      conditions: ["C2", "C5"],
      preset: "medium",
      store: "mem0",
      read_limit: 20,
    });
  });

  test("counts 8 sessions and 8 judge calls on the vendored subset", async () => {
    const count = await countConfig(readLongMemEvalConfig(B6_FIXTURE));
    expect(count.data.set).toBe("fixture");
    expect(count.items).toBe(4);
    expect(count.sessions).toBe(8);
    expect(count.per_condition).toEqual({ C2: 4, C5: 4 });
    expect(count.judge).toEqual({ model: "scripted/judge-1", calls_min: 8, calls_max: 8 });
    expect(countLines(count)).toContain(
      "judge scripted/judge-1: 8 calls (one per session, as upstream's evaluate_qa.py)",
    );
  });

  test("the command counts it offline, writing count.json and nothing else", () => {
    const out = join(fresh(), "out");
    const run = runScript(["--config", B6_FIXTURE, "--out", out, "--count"], {
      ENGRAM_OFFLINE: "1",
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("sessions: 8 = 4 items");
    expect(run.stdout).toContain("no model was called; no cassette was read or written");
    const count = JSON.parse(readFileSync(join(out, "count.json"), "utf8"));
    expect(count.data.dir).toBe("fixtures/bench/longmemeval");
  }, 30_000);

  test("replays B5's committed cassettes on Mem0 with zero new calls", async () => {
    const result = await runLongMemEvalConfig(readLongMemEvalConfig(B6_FIXTURE), {
      offline: true,
    });
    // Two reader calls (the read, then the answer) and one judge call per session.
    expect(result.calls).toEqual({ new: 0, cached: 24 });
    expect(result.rows).toHaveLength(8);
    expect(result.rows.every((r) => r.store === "mem0" && r.judge !== null)).toBe(true);
    expect(Object.keys(result.summary)).toEqual(["C2", "C5"]);
  }, 60_000);
});

/** A faux reader (a memory_read, then an answer) and a faux judge ("yes"), both on the seeded API. */
function fauxLive() {
  const seeds: unknown[] = [];
  const seed = (options: unknown) =>
    seeds.push((options as { samplingParams?: { seed?: unknown } })?.samplingParams?.seed);
  const reader = fauxProvider({
    api: "openai-completions",
    provider: "faux-live",
    models: [{ id: "model-1" }],
  });
  const read: FauxResponseFactory = (context, options) => {
    seed(options);
    return context.messages.at(-1)?.role === "toolResult"
      ? fauxAssistantMessage(fauxText("I don't know."))
      : fauxAssistantMessage(fauxToolCall("memory_read", { query: "degree" }), {
          stopReason: "toolUse",
        });
  };
  reader.setResponses(Array.from({ length: 64 }, () => read));
  const judge = fauxProvider({
    api: "openai-completions",
    provider: "faux-judge",
    models: [{ id: "judge-1" }],
  });
  const verdict: FauxResponseFactory = (_context, options) => {
    seed(options);
    return fauxAssistantMessage(fauxText("yes"));
  };
  judge.setResponses(Array.from({ length: 64 }, () => verdict));
  const models = createModels();
  models.setProvider(reader.provider);
  models.setProvider(judge.provider);
  return { models, seeds };
}

describe("a LongMemEval experiment, live and replayed", () => {
  test("records the reader's and the judge's calls, seeded, and its replay makes none", async () => {
    const base = {
      ...readLongMemEvalConfig(H2_LONGMEMEVAL_C5),
      data: FIXTURE_DATA,
      items: ["66f24dbb"],
      seeds: [2],
      judge: { model: "faux-judge/judge-1", temperature: 0, max_tokens: 10 },
    };
    const cassettes = join(fresh(), "cassettes");
    const config = liveConfig(base, { model: "faux-live/model-1", repo: REPO, cassettes, env: {} });
    const live = fauxLive();
    const first = await runLongMemEvalConfig(config, liveOptions(config, live.models, {}));
    expect(first.calls).toEqual({ new: 3, cached: 0 });
    expect(live.seeds).toEqual([2, 2, 2]);
    expect(first.rows[0]?.hypothesis).toBe("I don't know.");
    expect(first.rows[0]?.judge).toEqual({ reply: "yes", label: true });
    expect(first.rows[0]?.decisions.map((d) => `${d.op} ${d.decision}`)).toEqual(["read allow"]);
    expect(readdirSync(cassettes)).toHaveLength(3);

    const replayed = replayConfig(base, { model: "faux-live/model-1", repo: REPO, cassettes });
    const again = await runLongMemEvalConfig(replayed, replayOptions(replayed));
    expect(again.calls).toEqual({ new: 0, cached: 3 });
    expect(again.rows).toEqual(first.rows);
  }, 60_000);
});
