// Card RV1: a live run survives a transient provider error (RV-EXP-1), keeps
// every session it finished when it crashes or stops and resumes from there
// (RV-EXP-1, RV-EXP-2), stops at a per-provider spend ceiling (RV-EXP-4),
// and caps a session's turns (RV-EXP-5). pi-ai's faux provider stands in for
// a live provider on the seeded API; nothing here reaches the network, and
// every wait is injected.
import {
  appendFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  type AssistantMessage,
  createModels,
  type FauxResponseFactory,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import { type CacheEntry, type CacheStore, memoryCache } from "@engram/model";
import { afterAll, describe, expect, test } from "vitest";
import type { LiveModels } from "../src/answers.ts";
import { type Condition, readRunnerConfig } from "../src/config.ts";
import {
  forEachJsonl,
  JournalMismatch,
  RunJournal,
  runFingerprint,
  sessionId,
} from "../src/journal.ts";
import { liveConfig, liveOptions } from "../src/live.ts";
import { readMemInvConfig, runMemInvConfig } from "../src/mem-inv-probe.ts";
import { sessionFailure } from "../src/model/cassette.ts";
import { EVENTS_FILE, runConfig } from "../src/run.ts";
import { B3, B4, EXAMPLE } from "./paths.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const b3 = readRunnerConfig(B3);
/** One B3 checkpoint under C2 on the fake store: one memory read, then the answer. */
const one = {
  ...b3,
  items: [b3.items[1] as string],
  store: "fake" as const,
  conditions: ["C2"] as Condition[],
};
/** RN1's example: one checkpoint under C2, C3 and C5, two scripted calls a session. */
const example = readRunnerConfig(EXAMPLE);
const FAUX_MODEL = "faux-live/model-1";
const ANSWER = '{"action":"refuse","answer":"No.","answer_structured":{},"used_record_ids":[]}';
const noWait = { sleep: async () => {} };

const temp: string[] = [];
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-rv1-"));
  temp.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of temp) rmSync(dir, { recursive: true, force: true });
});

const usage = (cost: number): AssistantMessage["usage"] => ({
  input: 10,
  output: 5,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 15,
  cost: { input: cost / 2, output: cost / 2, cacheRead: 0, cacheWrite: 0, total: cost },
});

/**
 * A faux live provider on the seeded API: the first replies are `failures`
 * (pi-ai error messages), then a memory_read, then the answer once a read
 * came back; with `loop`, a memory_read every time. Each reply costs `cost`.
 */
function fauxLive(options: { failures?: string[]; cost?: number; loop?: boolean } = {}) {
  const faux = fauxProvider({
    api: "openai-completions",
    provider: "faux-live",
    models: [{ id: "model-1" }],
  });
  const state = { calls: 0 };
  const failures = [...(options.failures ?? [])];
  const step: FauxResponseFactory = (context) => {
    state.calls++;
    const failure = failures.shift();
    if (failure !== undefined) {
      return fauxAssistantMessage([], { stopReason: "error", errorMessage: failure });
    }
    const last = context.messages.at(-1);
    const reply =
      last?.role === "toolResult" && !options.loop
        ? fauxAssistantMessage(fauxText(ANSWER))
        : fauxAssistantMessage(fauxToolCall("memory_read", { query: "Monsoon" }), {
            stopReason: "toolUse",
          });
    return reply;
  };
  faux.setResponses(Array.from({ length: 256 }, () => step));
  const inner = createModels();
  inner.setProvider(faux.provider);
  // The faux provider estimates usage itself; a live provider reports its cost.
  const models: LiveModels = {
    getModel: (provider, id) => inner.getModel(provider, id),
    completeSimple: async (model, context, stream) => ({
      ...(await inner.completeSimple(model, context, stream)),
      usage: usage(options.cost ?? 0),
    }),
  };
  return { models, state };
}

const live = (config: typeof one, cassettes = join(fresh(), "cassettes")) =>
  liveConfig(config, { model: FAUX_MODEL, repo: REPO, cassettes, env: {} });

const journalFor = (dir: string, config: { name: string; [k: string]: unknown }, resume = false) =>
  RunJournal.open(dir, {
    identity: { config: config.name, fingerprint: runFingerprint(config) },
    resume,
    sidecar: EVENTS_FILE,
  });

const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");

describe("a transient error in the answer model (RV-EXP-1)", () => {
  test("the review's repro: a 429 first, then the read and the answer, gives one row and two new calls", async () => {
    const config = live(one);
    const provider = fauxLive({ failures: ["429 Too Many Requests"] });
    const slept: number[] = [];
    const result = await runConfig(config, {
      ...liveOptions(config, provider.models, {}),
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.output.action).toBe("refuse");
    // Three provider calls (the 429, the retried read, the answer), two recorded.
    expect(provider.state.calls).toBe(3);
    expect(result.calls).toEqual({ new: 2, cached: 0 });
    expect(readdirSync(config.cassettes)).toHaveLength(2);
    // GateMem's router waits a second after the first transient failure.
    expect(slept).toEqual([1000]);
  }, 60_000);

  test("a failure that is not transient still fails the run, after one attempt", async () => {
    const config = live(one);
    const provider = fauxLive({ failures: ["400 Bad Request"] });
    await expect(
      runConfig(config, { ...liveOptions(config, provider.models, {}), ...noWait }),
    ).rejects.toThrow(/model call failed: 400 Bad Request/);
    expect(provider.state.calls).toBe(1);
  }, 60_000);

  test("a transient failure that outlasts the retry fails the run, after GateMem's three attempts", async () => {
    const config = live(one);
    const provider = fauxLive({ failures: ["503 busy", "503 busy", "503 busy"] });
    await expect(
      runConfig(config, { ...liveOptions(config, provider.models, {}), ...noWait }),
    ).rejects.toThrow(/model call failed after 3 attempts: 503 busy/);
    expect(provider.state.calls).toBe(3);
  }, 60_000);

  test("a session is judged on its final assistant message: an error it recovered from is not a failure", () => {
    const recovered = [
      { role: "user" },
      { role: "assistant", stopReason: "error", errorMessage: "429" },
      { role: "assistant", stopReason: "stop" },
    ];
    const error = new Error("model call failed: 429");
    expect(sessionFailure(recovered, { errors: [error], capped: false })).toBeUndefined();
    const failed = recovered.slice(0, 2);
    expect(sessionFailure(failed, { errors: [error], capped: false })).toBe(error);
    expect(sessionFailure(failed, { errors: [], capped: true })).toBeUndefined();
  });
});

describe("results written as each session ends, and a resumed run (RV-EXP-1, RV-EXP-2)", () => {
  test("a run that crashes keeps the sessions it finished; a resume runs only the rest and writes the uninterrupted run's bytes", async () => {
    const cache = memoryCache();
    // The uninterrupted run, into its own folder.
    const whole = fresh();
    const journal = journalFor(whole, example);
    const complete = await runConfig(example, { cache, offline: false, journal });
    journal.close();
    expect(complete.sessions).toBe(3);
    expect(complete.rows).toEqual([]);

    // The same run, crashing as its second session's row is handed on.
    const crashed = fresh();
    const first = journalFor(crashed, example);
    let seen = 0;
    await expect(
      runConfig(example, {
        cache,
        offline: true,
        journal: first,
        onRow: () => {
          if (++seen === 2) throw new Error("the machine went away");
        },
      }),
    ).rejects.toThrow(/went away/);
    first.close();
    expect(read(crashed, "results.jsonl").trim().split("\n")).toHaveLength(2);
    // A crash in the middle of a write leaves half a line.
    appendFileSync(join(crashed, "results.jsonl"), '{"item":"gatemem/half');
    appendFileSync(join(crashed, EVENTS_FILE), '{"item":"gatemem/half"}\n{"item');

    const resumed = journalFor(crashed, example, true);
    expect(resumed.resumed).toBe(2);
    const counted = { calls: 0 };
    const counting: CacheStore = {
      get: (k) => {
        counted.calls++;
        return cache.get(k);
      },
      set: (e) => cache.set(e),
    };
    const rest = await runConfig(example, { cache: counting, offline: true, journal: resumed });
    resumed.close();
    expect(rest.resumed).toBe(2);
    expect(rest.sessions).toBe(3);
    // Only the third session ran: its two calls, from the cache.
    expect(rest.calls).toEqual({ new: 0, cached: 2 });
    expect(counted.calls).toBe(2);
    for (const file of ["results.jsonl", EVENTS_FILE, "summary.json"]) {
      expect(read(crashed, file), file).toBe(read(whole, file));
    }
    // The usage ledger holds every call of both invocations.
    expect(JSON.parse(read(crashed, "usage.json")).calls).toEqual({ new: 0, cached: 6 });
  }, 120_000);

  test("results.jsonl holds no plane log; events.jsonl holds each row's, in the same order", async () => {
    const dir = fresh();
    const journal = journalFor(dir, example);
    await runConfig(example, { cache: memoryCache(), offline: false, journal });
    journal.close();
    const rows: { condition: string; events?: unknown }[] = [];
    forEachJsonl<{ condition: string; events?: unknown }>(join(dir, "results.jsonl"), (r) =>
      rows.push(r),
    );
    const events: { condition: string; events: { op: string }[] }[] = [];
    forEachJsonl<{ condition: string; events: { op: string }[] }>(join(dir, EVENTS_FILE), (e) =>
      events.push(e),
    );
    expect(rows.map((r) => r.condition)).toEqual(["C2", "C3", "C5"]);
    expect(rows.every((r) => r.events === undefined)).toBe(true);
    expect(events.map((e) => e.condition)).toEqual(["C2", "C3", "C5"]);
    expect(events[0]?.events).toEqual([]);
    expect(events[2]?.events.at(-1)).toMatchObject({ op: "read" });
  }, 60_000);

  test("a resume refuses a folder another config wrote, or one with no record of its config", () => {
    const dir = fresh();
    journalFor(dir, example).close();
    expect(() => journalFor(dir, { ...example, seeds: [1, 2] }, true)).toThrow(JournalMismatch);
    // The spend ceiling and the paths are not the config's identity: raising the ceiling resumes.
    expect(() =>
      journalFor(dir, { ...example, spend_ceiling_usd: 5, cassettes: "/elsewhere" }, true).close(),
    ).not.toThrow();
    const bare = fresh();
    writeFileSync(join(bare, "results.jsonl"), "");
    expect(() => journalFor(bare, example, true)).toThrow(/no run.json/);
  });

  test("without resume a folder starts afresh", async () => {
    const dir = fresh();
    writeFileSync(join(dir, "results.jsonl"), '{"stale":true}\n');
    const journal = journalFor(dir, example);
    journal.close();
    expect(read(dir, "results.jsonl")).toBe("");
  });

  test("forEachJsonl reads lines longer than its chunk, multi-byte characters across chunk edges, and skips a torn last line", () => {
    const dir = fresh();
    const path = join(dir, "rows.jsonl");
    const long = "é".repeat(1_500_000);
    const rows = [{ a: 1 }, { text: long }, { b: "\u{1F600}" }];
    writeFileSync(path, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n{"torn":`);
    const seen: unknown[] = [];
    const { lines, bytes } = forEachJsonl(path, (r) => seen.push(r));
    expect(seen).toEqual(rows);
    expect(lines).toBe(3);
    expect(bytes).toBe(Buffer.byteLength(`${rows.map((r) => JSON.stringify(r)).join("\n")}\n`));
  });

  test("a session's id names its item, condition, store and seed", () => {
    expect(sessionId({ item: "gatemem/x", condition: "C1", store: "none", seed: 3 })).toBe(
      '["gatemem/x","C1","none",3]',
    );
  });
});

describe("the spend ceiling (RV-EXP-4)", () => {
  test("a model at a set cost per call stops at the ceiling, keeps the rows completed so far, and a raised ceiling resumes", async () => {
    const config = live({ ...one, conditions: ["C2", "C3", "C5"], spend_ceiling_usd: 0.03 });
    const dir = fresh();
    // Each session makes two calls of 0.01 USD: 0.02 after the first, 0.04 after the second.
    const provider = fauxLive({ cost: 0.01 });
    const journal = journalFor(dir, config);
    const stopped = await runConfig(config, {
      ...liveOptions(config, provider.models, {}),
      journal,
    });
    journal.close();
    expect(stopped.stopped).toEqual({
      reason: "spend ceiling",
      provider: "faux-live",
      spent_usd: 0.04,
      ceiling_usd: 0.03,
    });
    expect(stopped.sessions).toBe(2);
    expect(provider.state.calls).toBe(4);
    const summary = JSON.parse(read(dir, "summary.json"));
    expect(summary.stopped).toEqual(stopped.stopped);
    expect(summary.summary.C2.n_checkpoints).toBe(1);
    expect(summary.summary.C5.n_checkpoints).toBe(0);
    expect(read(dir, "results.jsonl").trim().split("\n")).toHaveLength(2);

    const raised = { ...config, spend_ceiling_usd: 1 };
    const again = journalFor(dir, raised, true);
    const rest = await runConfig(raised, {
      ...liveOptions(raised, provider.models, {}),
      journal: again,
    });
    again.close();
    expect(rest.stopped).toBeUndefined();
    expect(rest.resumed).toBe(2);
    expect(rest.sessions).toBe(3);
    // Only the third session's two calls were paid for.
    expect(rest.calls).toEqual({ new: 2, cached: 0 });
    expect(provider.state.calls).toBe(6);
    expect(JSON.parse(read(dir, "summary.json")).stopped).toBeUndefined();
  }, 120_000);

  test("without a journal the ceiling reads this invocation's ledger, and no ceiling never stops", async () => {
    const config = live({ ...one, conditions: ["C2", "C3"], spend_ceiling_usd: 0.01 });
    const capped = await runConfig(
      config,
      liveOptions(config, fauxLive({ cost: 0.01 }).models, {}),
    );
    expect(capped.rows).toHaveLength(1);
    expect(capped.stopped?.provider).toBe("faux-live");
    const { spend_ceiling_usd: _c, ...open } = config;
    const free = await runConfig(open, liveOptions(open, fauxLive({ cost: 0.01 }).models, {}));
    expect(free.rows).toHaveLength(2);
    expect(free.stopped).toBeUndefined();
  }, 120_000);
});

describe("the turn limit (RV-EXP-5)", () => {
  test("a model that never stops reading is cut off at the limit, its session excluded under its own reason, and a replay caps it the same way", async () => {
    const config = live({ ...one, conditions: ["C2", "C5"], turn_limit: 3 });
    const provider = fauxLive({ loop: true });
    const result = await runConfig(config, liveOptions(config, provider.models, {}));
    expect(result.rows.map((r) => r.excluded)).toEqual(["turn limit", "turn limit"]);
    expect(result.rows.map((r) => r.tool_calls.length)).toEqual([3, 3]);
    // Three calls per session, and the fourth never made.
    expect(provider.state.calls).toBe(6);
    expect(result.calls).toEqual({ new: 6, cached: 0 });
    expect(result.excluded).toEqual({ C2: { "turn limit": 1 }, C5: { "turn limit": 1 } });
    expect(result.summary.C2?.n_checkpoints).toBe(0);
    const replay = await runConfig(config, { ...liveOptions(config, fauxLive().models, {}) });
    expect(replay.calls).toEqual({ new: 0, cached: 6 });
    expect(replay.rows).toEqual(result.rows);
  }, 120_000);

  test("a limit the session stays under changes nothing, and is not in any cache key: the committed cassettes replay", async () => {
    const limited = { ...example, turn_limit: 8 };
    const result = await runConfig(limited, { offline: true });
    expect(result.calls).toEqual({ new: 0, cached: 6 });
    expect(result.rows.every((r) => r.excluded === undefined)).toBe(true);
    const unlimited = await runConfig(example, { offline: true });
    expect(result.rows).toEqual(unlimited.rows);
    expect(result.summary).toEqual(unlimited.summary);
    expect(result.excluded).toBeUndefined();
  }, 120_000);
});

describe("MEM-INV-Bench's item ids (RV-EXP-10)", () => {
  test("the case's entries carry the same item ids under C5 as under C2: the plane's events count apart", async () => {
    const config = readMemInvConfig(B4);
    const entries: CacheEntry[] = [];
    const cache: CacheStore = {
      get: () => undefined,
      set: (e) => {
        entries.push(e);
      },
    };
    await runMemInvConfig(config, { cache, offline: false });
    const ids = (condition: string) =>
      [
        ...new Set(
          entries
            .filter((e) => e.context.condition === condition)
            .flatMap((e) => e.request.messages.map((m) => m.content))
            .flatMap((text) => [...text.matchAll(/item_id=\\"([0-9a-f-]+)\\"/g)].map((m) => m[1])),
        ),
      ].sort();
    expect(ids("C2")).toEqual([
      "01920000-0000-7000-8000-000000000001",
      "01920000-0000-7000-8000-000000000002",
    ]);
    expect(ids("C5")).toEqual(ids("C2"));
  }, 120_000);
});
