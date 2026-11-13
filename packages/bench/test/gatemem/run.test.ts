import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fileCache, memoryCache, OfflineMissError } from "@engram/model";
import { describe, expect, test } from "vitest";
import { readJudgeScript, scriptedJudge } from "../../src/gatemem/judge.ts";
import {
  dryRunGateMem,
  readRunConfig,
  readScript,
  runGateMem,
  scriptedByItem,
} from "../../src/gatemem/run.ts";
import { CONFIG } from "./fixture.ts";

const config = readRunConfig(CONFIG);
const script = readScript(config.script as string);

/** The scripted model, counting how often it is reached. */
function counting() {
  const scripted = scriptedByItem(script);
  const counter = { calls: 0 };
  const model = (id: string) => async (request: Parameters<ReturnType<typeof scripted>>[0]) => {
    counter.calls++;
    return scripted(id)(request);
  };
  return { model, counter };
}

describe("GateMem run through cached()", () => {
  test("a rerun with the same config makes zero new model calls (memory cache)", async () => {
    const cache = memoryCache();
    const first = counting();
    const a = await runGateMem(config, { model: first.model, cache, offline: false });
    expect(first.counter.calls).toBe(20);
    const second = counting();
    const b = await runGateMem(config, { model: second.model, cache, offline: false });
    expect(second.counter.calls).toBe(0);
    expect(b.usage.every((u) => u.hit)).toBe(true);
    expect(b.predictions).toEqual(a.predictions);
  });

  test("a rerun with the same config makes zero new model calls (file cache)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gatemem-cache-"));
    const first = counting();
    await runGateMem(config, { model: first.model, cache: fileCache(dir), offline: false });
    expect(readdirSync(dir)).toHaveLength(20);
    const second = counting();
    await runGateMem(config, { model: second.model, cache: fileCache(dir), offline: true });
    expect(second.counter.calls).toBe(0);
  });

  test("a different seed is a different cache key, so it reaches the model again", async () => {
    const cache = memoryCache();
    await runGateMem(config, { model: counting().model, cache, offline: false });
    const reseeded = counting();
    await runGateMem({ ...config, seed: 2 }, { model: reseeded.model, cache, offline: false });
    expect(reseeded.counter.calls).toBe(20);
  });

  test("offline, a cache miss is an error and the model is never reached", async () => {
    const c = counting();
    await expect(
      runGateMem(config, { model: c.model, cache: memoryCache(), offline: true }),
    ).rejects.toBeInstanceOf(OfflineMissError);
    expect(c.counter.calls).toBe(0);
  });

  test("the committed cassettes replay the whole fixture offline", async () => {
    const c = counting();
    const result = await runGateMem(config, {
      model: c.model,
      cache: fileCache(config.cassettes as string),
      offline: true,
    });
    expect(c.counter.calls).toBe(0);
    expect(result.predictions).toHaveLength(20);
  });
});

describe("make bench BENCH=gatemem", () => {
  test("writes predictions in GateMem's format and a rule-based summary, offline", () => {
    const out = mkdtempSync(join(tmpdir(), "gatemem-bench-"));
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    const stdout = execFileSync(
      process.execPath,
      ["packages/bench/scripts/run-gatemem.ts", "--config", CONFIG, "--out", out],
      { cwd: root, env: { ...process.env, ENGRAM_OFFLINE: "1" }, encoding: "utf8" },
    );
    expect(stdout).toContain("model calls: 0 new, 20 from cassettes");
    expect(stdout).toContain("judge calls: 0 new, 24 from cassettes");
    expect(stdout).toContain(
      "LLM judge (scripted/judge-1, scripted verdicts; not comparable with the paper): action_ok 0.950, utility 0.167, privacy_leak 0.167, deletion_leak 0.143, parse failures 0.050",
    );
    const rows = readFileSync(join(out, "predictions.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { checkpoint_id: string; output: { action: string } });
    expect(rows).toHaveLength(20);
    for (const r of rows) {
      expect(typeof r.checkpoint_id).toBe("string");
      expect(["answer", "answer_redacted", "refuse", "no_memory"]).toContain(r.output.action);
    }
    const summary = JSON.parse(readFileSync(join(out, "summary.json"), "utf8"));
    expect(summary.n_checkpoints).toBe(20);
    expect(summary.judge).toBe("run");
    const judged = JSON.parse(readFileSync(join(out, "judge_summary.json"), "utf8"));
    expect(judged.action_accuracy).toBe(0.95);
    expect(judged.llm_judge.n_judged).toBe(20);
    const judgeRows = readFileSync(join(out, "judge_scores.jsonl"), "utf8").split("\n");
    expect(judgeRows.filter(Boolean)).toHaveLength(20);
  }, 60_000);

  test("online, a missing cassette is recorded under --out, never into the committed ones (R6-5)", () => {
    const work = mkdtempSync(join(tmpdir(), "gatemem-online-"));
    const committed = join(work, "cassettes");
    cpSync(config.cassettes as string, committed, { recursive: true });
    const [dropped] = readdirSync(committed).sort();
    rmSync(join(committed, dropped as string));
    const before = readdirSync(committed).sort();
    const configPath = join(work, "run-config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        ...JSON.parse(readFileSync(CONFIG, "utf8")),
        data: config.data,
        script: config.script,
        cassettes: committed,
        judge: config.judge,
      }),
    );
    const out = join(work, "out");
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    const { ENGRAM_OFFLINE: _offline, ...env } = process.env;
    const stdout = execFileSync(
      process.execPath,
      ["packages/bench/scripts/run-gatemem.ts", "--config", configPath, "--out", out],
      { cwd: root, env, encoding: "utf8" },
    );
    expect(stdout).toContain("model calls: 1 new, 19 from cassettes");
    expect(readdirSync(committed).sort()).toEqual(before);
    expect(readdirSync(join(out, "cassettes"))).toEqual([dropped]);
  }, 60_000);
});

describe("the judge in a run", () => {
  test("replays from its committed cassettes offline: 24 calls, no judge reached", async () => {
    const judge = config.judge;
    if (!judge?.script || !judge.cassettes) throw new Error("the fixture config names no judge");
    const scripted = scriptedJudge(readJudgeScript(judge.script));
    let reached = 0;
    const result = await runGateMem(config, {
      model: counting().model,
      cache: fileCache(config.cassettes as string),
      judge: {
        model: (id) => async (request) => {
          reached++;
          return scripted(id)(request);
        },
        cache: fileCache(judge.cassettes),
      },
      offline: true,
    });
    expect(reached).toBe(0);
    expect(result.judge?.usage).toHaveLength(24);
    expect(readdirSync(judge.cassettes)).toHaveLength(24);
    expect(result.judge?.rows).toHaveLength(20);
    expect(result.summary.judge).toBe("run");
  });

  test("without a judge model only the rule-based scorer runs", async () => {
    const result = await runGateMem(config, {
      model: counting().model,
      cache: fileCache(config.cassettes as string),
      offline: true,
    });
    expect(result.judge).toBeUndefined();
    expect(result.summary.judge).toBe("not run");
  });
});

describe("make bench BENCH=gatemem DRY=1", () => {
  test("counts one answer call per checkpoint at the keys the live run uses, reaching no model", async () => {
    const dry = await dryRunGateMem(config, { judgeModel: "openai/gpt-4o" });
    expect(dry.checkpoints).toBe(20);
    expect(dry.episodes).toBe(4);
    expect(dry.answer.calls).toBe(20);
    expect(dry.answer.unique_keys).toBe(20);
    expect(dry.judge).toMatchObject({ calls_min: 20, calls_max: 60 });
    expect(dry.answer.input_chars).toBeGreaterThan(0);
    // The keys are the committed cassettes' names: the requests of the run that recorded them.
    const committed = readdirSync(config.cassettes as string).map((f) => f.replace(/\.json$/, ""));
    expect(dry.answer.keys.map((k) => k.key).sort()).toEqual(committed.sort());
  });

  test("another model or seed gives other keys and the same counts", async () => {
    const a = await dryRunGateMem(config, { judgeModel: "openai/gpt-4o" });
    const b = await dryRunGateMem(
      { ...config, model: "openai/gpt-4o-mini", seed: 7 },
      { judgeModel: "openai/gpt-4o" },
    );
    expect(b.answer.calls).toBe(a.answer.calls);
    expect(b.answer.input_chars).toBe(a.answer.input_chars);
    const keys = new Set(a.answer.keys.map((k) => k.key));
    expect(b.answer.keys.some((k) => keys.has(k.key))).toBe(false);
  });

  test("the script labels data that is not the pinned full set and writes the keys", () => {
    const out = mkdtempSync(join(tmpdir(), "gatemem-dry-"));
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    const stdout = execFileSync(
      process.execPath,
      [
        "packages/bench/scripts/dry-run-gatemem.ts",
        "--config",
        CONFIG,
        "--data",
        config.data,
        "--out",
        out,
      ],
      { cwd: root, env: { ...process.env, ENGRAM_OFFLINE: "1" }, encoding: "utf8" },
    );
    expect(stdout).toContain("NOT the pinned full set (0 of 8 files match the manifest)");
    expect(stdout).toContain("20 calls");
    expect(stdout).toContain("no model was called");
    // Without MODEL= the keys would be the fixture's scripted model's, which no live run uses (P6-5).
    expect(stdout).toContain("cache keys: not computed; name the live model with MODEL=");
    expect(stdout).not.toContain("distinct cache keys");
    const report = JSON.parse(readFileSync(join(out, "dry-run.json"), "utf8"));
    expect(report.pinned_full_set).toBe(false);
    expect(report.answer.keys).toBeUndefined();
    expect(report.answer.unique_keys).toBeUndefined();
    expect(report.model).toBeUndefined();
  }, 60_000);

  test("with --model the script prints and writes the keys for that model (P6-5)", () => {
    const out = mkdtempSync(join(tmpdir(), "gatemem-dry-model-"));
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    const stdout = execFileSync(
      process.execPath,
      [
        "packages/bench/scripts/dry-run-gatemem.ts",
        "--config",
        CONFIG,
        "--data",
        config.data,
        "--out",
        out,
        "--model",
        "openai/gpt-4o",
      ],
      { cwd: root, env: { ...process.env, ENGRAM_OFFLINE: "1" }, encoding: "utf8" },
    );
    expect(stdout).toContain(
      "answer model openai/gpt-4o, seed 1: 20 calls at 20 distinct cache keys",
    );
    const report = JSON.parse(readFileSync(join(out, "dry-run.json"), "utf8"));
    expect(report.model).toBe("openai/gpt-4o");
    expect(report.answer.keys).toHaveLength(20);
  }, 60_000);
});

describe("make fixtures records the GateMem cassettes (P6-3)", () => {
  test("--record writes answer and judge cassettes into the config's folders, byte-identical to the committed ones", () => {
    const work = mkdtempSync(join(tmpdir(), "gatemem-record-"));
    const judge = config.judge;
    if (!judge?.cassettes) throw new Error("the fixture config names no judge cassettes");
    const answers = join(work, "cassettes");
    const judged = join(work, "judge-cassettes");
    const configPath = join(work, "run-config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        ...JSON.parse(readFileSync(CONFIG, "utf8")),
        data: config.data,
        script: config.script,
        cassettes: answers,
        judge: { ...judge, cassettes: judged },
      }),
    );
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    const { ENGRAM_OFFLINE: _offline, ...env } = process.env;
    const stdout = execFileSync(
      process.execPath,
      [
        "packages/bench/scripts/run-gatemem.ts",
        "--config",
        configPath,
        "--out",
        join(work, "out"),
        "--record",
      ],
      { cwd: root, env, encoding: "utf8" },
    );
    expect(stdout).toContain("model calls: 20 new, 0 from cassettes");
    expect(stdout).toContain("judge calls: 24 new, 0 from cassettes");
    const pairs: [string, string][] = [
      [answers, config.cassettes as string],
      [judged, judge.cassettes],
    ];
    for (const [mine, committed] of pairs) {
      const names = readdirSync(committed).sort();
      expect(readdirSync(mine).sort()).toEqual(names);
      for (const n of names) {
        expect(readFileSync(join(mine, n), "utf8"), n).toBe(
          readFileSync(join(committed, n), "utf8"),
        );
      }
    }
  }, 60_000);

  test("--record empties the folders first: a stale cassette goes, an altered one is rewritten (P6-10)", () => {
    const work = mkdtempSync(join(tmpdir(), "gatemem-record-stale-"));
    const judge = config.judge;
    if (!judge?.cassettes) throw new Error("the fixture config names no judge cassettes");
    const answers = join(work, "cassettes");
    const judged = join(work, "judge-cassettes");
    const committedAnswers = config.cassettes as string;
    cpSync(committedAnswers, answers, { recursive: true });
    cpSync(judge.cassettes, judged, { recursive: true });
    const stale = `${"0".repeat(64)}.json`;
    writeFileSync(join(answers, stale), "{}\n");
    writeFileSync(join(judged, stale), "{}\n");
    const [altered] = readdirSync(committedAnswers).sort();
    if (!altered) throw new Error("no committed answer cassette");
    const original = readFileSync(join(committedAnswers, altered), "utf8");
    const entry = JSON.parse(original);
    entry.response.text = "an altered response";
    writeFileSync(join(answers, altered), `${JSON.stringify(entry, null, 2)}\n`);
    const configPath = join(work, "run-config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        ...JSON.parse(readFileSync(CONFIG, "utf8")),
        data: config.data,
        script: config.script,
        cassettes: answers,
        judge: { ...judge, cassettes: judged },
      }),
    );
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    const { ENGRAM_OFFLINE: _offline, ...env } = process.env;
    execFileSync(
      process.execPath,
      [
        "packages/bench/scripts/run-gatemem.ts",
        "--config",
        configPath,
        "--out",
        join(work, "out"),
        "--record",
      ],
      { cwd: root, env, encoding: "utf8" },
    );
    expect(readdirSync(answers)).not.toContain(stale);
    expect(readdirSync(judged)).not.toContain(stale);
    expect(readFileSync(join(answers, altered), "utf8")).toBe(original);
  }, 60_000);

  test("--record refuses to run offline", () => {
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    const out = mkdtempSync(join(tmpdir(), "gatemem-record-offline-"));
    expect(() =>
      execFileSync(
        process.execPath,
        ["packages/bench/scripts/run-gatemem.ts", "--config", CONFIG, "--out", out, "--record"],
        {
          cwd: root,
          env: { ...process.env, ENGRAM_OFFLINE: "1" },
          encoding: "utf8",
          stdio: "pipe",
        },
      ),
    ).toThrow(/--record/);
  });
});
