// Acceptance for card X1 (condition runner: ungoverned, instruction-only,
// enforced at a preset; seeds from config; caching): a re-run with the same
// config makes zero new model calls, for every condition on both of H1's arms
// (GateMem: C1 to C5, C4 with either verdict source, and the answer judge;
// MEM-INV-Bench: C2 to C5 on every store, and the agent's notes). The suite
// research/configs/x1-h1-probe.json holds the arms; its cassettes are
// committed, recorded by `make fixtures` from the scripted model.
//
//   ENGRAM_OFFLINE=1 make run CONFIG=research/configs/x1-h1-probe.json
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CacheEntry, CacheStore } from "@engram/model";
import { describe, expect, test } from "vitest";
import { CONDITIONS, readRunnerConfig, readSuite } from "../src/config.ts";
import { readMemInvConfig, runMemInvConfig } from "../src/mem-inv-probe.ts";
import { runConfig } from "../src/run.ts";
import { X1_GATEMEM, X1_GATEMEM_RAG, X1_MEM_INV, X1_SUITE } from "./paths.ts";

const REPO = resolve(import.meta.dirname, "../../..");

function recordingCache(): CacheStore & { entries: CacheEntry[] } {
  const entries: CacheEntry[] = [];
  return {
    entries,
    get: (key) => entries.find((e) => e.key === key),
    set: (entry) => {
      entries.push(entry);
    },
  };
}

/**
 * What no condition may tell the model (PR #25 review, P3-3): which
 * benchmark it is in, or that it is one. The judge's requests are the
 * scorer's, not a condition's, and are left out.
 */
const CUES = /GateMem|MEM-INV|benchmark|baseline/i;
const conditionRequests = (entries: CacheEntry[], model: string) =>
  entries.filter((e) => e.request.model === model).map((e) => JSON.stringify(e.request));

describe("acceptance (card X1): a re-run makes zero new model calls, every condition, both arms", () => {
  test("the suite is the arms", () => {
    const suite = readSuite(X1_SUITE);
    expect(suite.name).toBe("x1-h1-probe");
    expect(suite.members.map((m) => resolve(m))).toEqual([
      resolve(X1_GATEMEM),
      resolve(X1_GATEMEM_RAG),
      resolve(X1_MEM_INV),
    ]);
  });

  test("GateMem, C1 to C5 with the judge: a re-run answers every call from the cache it filled", async () => {
    const config = readRunnerConfig(X1_GATEMEM);
    expect(config.conditions).toEqual([...CONDITIONS]);
    const cache = recordingCache();
    const first = await runConfig(config, { cache, offline: false });
    const again = await runConfig(config, { cache, offline: false });
    expect(new Set(first.rows.map((r) => r.condition))).toEqual(new Set(CONDITIONS));
    // Two answer calls per session (the read, then the answer), one for C1's,
    // and one judge call per session.
    expect(first.calls).toEqual({ new: 36 + 20, cached: 0 });
    expect(again.calls).toEqual({ new: 0, cached: 56 });
    expect(again.rows).toEqual(first.rows);
    const sent = conditionRequests(cache.entries, config.model);
    expect(sent).toHaveLength(36);
    expect(sent.filter((r) => CUES.test(r))).toEqual([]);
  }, 120_000);

  test("GateMem, C4 with the RAG-Policy's verdicts: no cue either", async () => {
    const config = readRunnerConfig(X1_GATEMEM_RAG);
    const cache = recordingCache();
    const first = await runConfig(config, { cache, offline: false });
    expect(first.calls).toEqual({ new: 4, cached: 0 });
    expect(conditionRequests(cache.entries, config.model).filter((r) => CUES.test(r))).toEqual([]);
  }, 60_000);

  test("MEM-INV-Bench, C2 to C5 on fake, Mem0 and Letta: a re-run answers every call from the cache it filled", async () => {
    const config = readMemInvConfig(X1_MEM_INV);
    const cache = recordingCache();
    const first = await runMemInvConfig(config, { cache, offline: false });
    const again = await runMemInvConfig(config, { cache, offline: false });
    expect(new Set(first.rows.map((r) => `${r.condition}@${r.store}`)).size).toBe(4 * 3);
    // Two calls per session, and one agent note for the summarising case.
    expect(first.calls).toEqual({ new: 49, cached: 0 });
    expect(again.calls).toEqual({ new: 0, cached: 49 });
    expect(again.rows).toEqual(first.rows);
    const sent = conditionRequests(cache.entries, config.model);
    expect(sent).toHaveLength(49);
    expect(sent.filter((r) => CUES.test(r))).toEqual([]);
  }, 300_000);

  test("offline, the committed cassettes answer every call of the suite", () => {
    const out = mkdtempSync(join(tmpdir(), "engram-x1-out-"));
    try {
      const run = spawnSync(
        process.execPath,
        [join(REPO, "packages/runner/scripts/run.ts"), "--config", X1_SUITE, "--out", out],
        { env: { ...process.env, ENGRAM_OFFLINE: "1" }, encoding: "utf8" },
      );
      expect(run.stderr).not.toMatch(/offline .* no cassette/);
      expect(run.status).toBe(0);
      expect(run.stdout).toContain(
        "x1-h1-probe: 3 configs, 46 sessions; model calls in all: 0 new, 109 from cassettes",
      );
      const usage = JSON.parse(readFileSync(join(out, "x1-h1-mem-inv", "usage.json"), "utf8"));
      expect(usage.calls).toEqual({ new: 0, cached: 49 });
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 300_000);
});
