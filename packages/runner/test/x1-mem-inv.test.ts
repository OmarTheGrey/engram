// Card X1, plan decisions 4 and 5: MEM-INV-Bench's C4 (each item a read
// returns carries its channel and provenance kind; the model decides), the
// probe on every store, and the same live, replay and model path as GateMem's
// (src/live.ts). pi-ai's faux provider stands in for a live provider on the
// seeded API; nothing reaches the network.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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
import { memInvBench } from "@engram/bench";
import { loadPreset } from "@engram/core";
import { afterAll, describe, expect, test } from "vitest";
import { answersFor } from "../src/answers.ts";
import type { Condition } from "../src/config.ts";
import { liveConfig, liveOptions, replayConfig, replayOptions } from "../src/live.ts";
import {
  entryAttributes,
  MEM_INV_METADATA_LEGEND,
  type MemInvProbeSpec,
  parseMemInvConfig,
  readMemInvConfig,
  runMemInvConfig,
  runMemInvProbe,
} from "../src/mem-inv-probe.ts";
import type { CacheEntry, CacheStore } from "../src/model/cached.ts";
import type { StoreName } from "../src/stores.ts";
import { X1_MEM_INV } from "./paths.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const config = readMemInvConfig(X1_MEM_INV);
const cases = memInvBench.loadCases(config.data);
const theCase = (id: string) => memInvBench.findCase(cases, id);
const temp: string[] = [];
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-x1-live-"));
  temp.push(dir);
  return dir;
};
afterAll(() => {
  for (const d of temp) rmSync(d, { recursive: true, force: true });
});

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

const spec = (
  c: memInvBench.Case,
  condition: Condition,
  cache: CacheStore,
  store: StoreName = "fake",
): MemInvProbeSpec => ({
  case: c,
  condition,
  seed: 1,
  model: config.model,
  preset: config.preset,
  policy: loadPreset(config.preset),
  store,
  cache,
  answers: answersFor(config, c.case_id, condition),
  offline: false,
});

describe("C4 on MEM-INV-Bench: each item's channel and provenance kind (ADR 0031)", () => {
  test("the agent's own summary reaches the model as channel agent, provenance model; the filler as erp, tool", async () => {
    const cache = recordingCache();
    const row = await runMemInvProbe(spec(theCase("mib-14"), "C4", cache));
    const last = JSON.stringify(cache.entries.at(-1)?.request);
    expect(last).toMatch(/channel=\\+"agent\\+" provenance=\\+"model\\+"/);
    expect(last).toMatch(/channel=\\+"erp\\+" provenance=\\+"tool\\+"/);
    expect(last).toContain("<memory-policy>");
    expect(last).toContain("<memory-metadata>");
    expect(row.writes.every((w) => w.decision === "ungoverned")).toBe(true);
    expect(cache.entries.at(-1)?.context.preset).toBe("medium");
  });

  test("the attributes are the entry's channel and the item's provenance kind, in that order", () => {
    const entry = theCase("mib-14").memory[0] as memInvBench.MemoryEntry;
    const item = memInvBench.entryItem(entry, "id", "2026-01-01T00:00:00.000Z");
    expect(entryAttributes(entry, item)).toEqual([
      ["channel", entry.channel],
      ["provenance", memInvBench.entryKind(entry)],
    ]);
    expect(MEM_INV_METADATA_LEGEND).toContain("channel:");
    expect(MEM_INV_METADATA_LEGEND).toContain("provenance:");
  });

  test("C3 and C4 send the model the same requests when every label and scoring key changes", async () => {
    for (const condition of ["C3", "C4"] as const) {
      const c = theCase("mib-14");
      const relabelled = memInvBench.Case.parse({
        ...c,
        channel: "direct",
        sid: "elsewhere",
        domain: "elsewhere",
        tool: "send_data",
        tier: c.tier === "HIGH" ? "ROUTINE" : "HIGH",
        entity: "Someone Else",
        evil: "EVIL-0000",
        good: "GOOD-0000",
      });
      const before = recordingCache();
      const after = recordingCache();
      await runMemInvProbe(spec(c, condition, before));
      await runMemInvProbe(spec(relabelled, condition, after));
      expect(
        after.entries.map((e) => e.key),
        condition,
      ).toEqual(before.entries.map((e) => e.key));
    }
  });

  test("a MEM-INV-Bench config may not name C1", () => {
    const raw = JSON.parse(readFileSync(X1_MEM_INV, "utf8"));
    expect(() => parseMemInvConfig({ ...raw, conditions: ["C1", "C2"] })).toThrow(/C1/);
  });
});

describe("MEM-INV-Bench on every store (card X1)", () => {
  test.each(["mem0", "letta"] as const)(
    "on %s the read shows the case's memory under C2 and C5, as on the fake",
    async (store) => {
      const c = theCase("mib-14");
      for (const condition of ["C2", "C5"] as const) {
        const row = await runMemInvProbe(spec(c, condition, recordingCache(), store));
        expect(row.store).toBe(store);
        expect(row.stored, condition).toBe(c.memory.length);
        for (const entry of c.memory) expect(row.read.join("\n"), condition).toContain(entry.text);
      }
    },
    120_000,
  );
});

/** A faux "live" provider: a memory_read first, then a reply; it records the seed it was sent. */
function fauxLive() {
  const faux = fauxProvider({
    api: "openai-completions",
    provider: "faux-live",
    models: [{ id: "model-1" }],
  });
  const seeds: unknown[] = [];
  const step: FauxResponseFactory = (context, options) => {
    seeds.push((options as { samplingParams?: { seed?: unknown } })?.samplingParams?.seed);
    return context.messages.at(-1)?.role === "toolResult"
      ? fauxAssistantMessage(fauxText('{"tool":"answer","text":"I will check with you first."}'))
      : fauxAssistantMessage(fauxToolCall("memory_read", { query: "" }), {
          stopReason: "toolUse",
        });
  };
  faux.setResponses(Array.from({ length: 64 }, () => step));
  const models = createModels();
  models.setProvider(faux.provider);
  return { models, seeds };
}

const FAUX_MODEL = "faux-live/model-1";
const one = { ...config, items: ["mib-14"], store: "fake" as const, conditions: ["C4" as const] };

describe("MEM-INV-Bench's live path (plan decision 5)", () => {
  test("a live run records a named model's calls, seeded, under the given directory; a rerun and a replay make none", async () => {
    const cassettes = join(fresh(), "cassettes");
    const live = liveConfig(one, { model: FAUX_MODEL, repo: REPO, cassettes, env: {} });
    const faux = fauxLive();
    const first = await runMemInvConfig(live, liveOptions(live, faux.models, {}));
    expect(first.calls).toEqual({ new: 2, cached: 0 });
    expect(faux.seeds).toEqual([1, 1]);
    expect(readdirSync(cassettes)).toHaveLength(2);
    expect(first.rows[0]?.proposal).toContain("check with you");

    const again = await runMemInvConfig(live, liveOptions(live, fauxLive().models, {}));
    expect(again.calls).toEqual({ new: 0, cached: 2 });
    expect(again.rows).toEqual(first.rows);

    const replay = replayConfig(one, { model: FAUX_MODEL, repo: REPO, cassettes });
    const replayed = await runMemInvConfig(replay, replayOptions(replay));
    expect(replayed.calls).toEqual({ new: 0, cached: 2 });
    expect(replayed.rows).toEqual(first.rows);
  }, 60_000);

  test("by default it records under .engram/runs, never under fixtures", () => {
    expect(liveConfig(config, { model: "openai/gpt-4o", repo: REPO, env: {} }).cassettes).toBe(
      resolve(REPO, ".engram/runs/x1-h1-mem-inv-live/openai/gpt-4o/cassettes"),
    );
    expect(() =>
      liveConfig(config, { model: FAUX_MODEL, repo: REPO, cassettes: config.cassettes, env: {} }),
    ).toThrow(/overlaps the committed cassettes/);
  });

  test("the command takes --live for a MEM-INV-Bench config and refuses it offline before any session", () => {
    const out = join(fresh(), "out");
    const run = spawnSync(
      process.execPath,
      [
        join(REPO, "packages/runner/scripts/run.ts"),
        "--config",
        X1_MEM_INV,
        "--out",
        out,
        "--live",
        "--model",
        FAUX_MODEL,
        "--cassettes",
        fresh(),
      ],
      { env: { ...process.env, ENGRAM_OFFLINE: "1" }, encoding: "utf8" },
    );
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/live run refused: ENGRAM_OFFLINE=1/);
    expect(run.stderr).not.toMatch(/has no --live/);
    expect(existsSync(out)).toBe(false);
  }, 30_000);
});
