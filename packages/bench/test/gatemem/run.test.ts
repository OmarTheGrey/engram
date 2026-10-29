import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fileCache, memoryCache, OfflineMissError } from "@engram/runner";
import { describe, expect, test } from "vitest";
import { readRunConfig, readScript, runGateMem, scriptedByItem } from "../../src/gatemem/run.ts";
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
    expect(stdout).toContain("LLM judge: not run");
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
    expect(summary.judge).toBe("not run");
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
