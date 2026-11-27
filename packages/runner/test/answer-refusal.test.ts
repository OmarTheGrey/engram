// Card X20 (pre-tag condition 3, lead-decisions item 14): an answer call the
// provider refused with an error no retry can fix (a prompt over the
// context limit) excludes that session under its own reason, `answer
// refused`, counted per condition, and the run goes on; so does OpenRouter's
// moderation 403. An HTTP 401, 402, 404 or any other 403, at the answer call
// or the judge, stops the run, names its status, records nothing for that
// session, and a resume runs it once the key, credit or endpoint is fixed;
// five refusals in a row stop it too (the backstop, review X20-2). A replay
// excludes the same session from its cassette with zero calls. pi-ai's faux provider
// stands in for OpenRouter on the seeded API, answering with error messages
// in the shapes pi-ai 1.3.0 gives OpenRouter's documented error bodies;
// nothing here reaches the network, and every wait is injected.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { gatemem } from "@engram/bench";
import { TransientCallError } from "@engram/model";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { type Condition, readRunnerConfig } from "../src/config.ts";
import type { ProbeResult } from "../src/gatemem-probe.ts";
import { forEachJsonl, RunJournal, runFingerprint } from "../src/journal.ts";
import { liveConfig, liveOptions, replayOptions } from "../src/live.ts";
import { readLongMemEvalConfig, runLongMemEvalConfig } from "../src/longmemeval-probe.ts";
import { readMemInvConfig, runMemInvConfig } from "../src/mem-inv-probe.ts";
import {
  AnswerRefused,
  answerFailure,
  REFUSAL_STREAK_LIMIT,
  REFUSED_ANSWER_MARK,
  RefusalStreak,
  resetRefusalStreak,
  sessionEnd,
  sessionFailure,
} from "../src/model/cassette.ts";
import { httpStatus, JUDGE_RETRY, ProviderStopError, SESSION_RETRY } from "../src/model/retry.ts";
import { gatememSessions, memInvViolation } from "../src/research/h1-sessions.ts";
import { EVENTS_FILE, gatememItems, runConfig } from "../src/run.ts";
import { FAUX_MODEL, fauxLive, JUDGE_MODEL, withJudge } from "./live-fakes.ts";
import { B3, B4 } from "./paths.ts";

const REPO = resolve(import.meta.dirname, "../../..");
const CONFIGS = join(REPO, "research/configs");
const b3 = readRunnerConfig(B3);
/** One B3 checkpoint on the fake store under C2 and C3: two sessions, two calls each when answered. */
const two = {
  ...b3,
  items: [b3.items[1] as string],
  store: "fake" as const,
  conditions: ["C2", "C3"] as Condition[],
};
const noWait = { sleep: async () => {} };

const temp: string[] = [];
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "engram-x20-"));
  temp.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of temp) rmSync(dir, { recursive: true, force: true });
});
// The backstop counts refusals in a row across one process; each test starts afresh.
beforeEach(() => resetRefusalStreak());

const liveOf = <C extends { name: string; model: string; cassettes: string }>(config: C) =>
  liveConfig(config, {
    model: FAUX_MODEL,
    repo: REPO,
    cassettes: join(fresh(), "cassettes"),
    env: {},
  });

const journalFor = (dir: string, config: { name: string; [k: string]: unknown }, resume = false) =>
  RunJournal.open(dir, {
    identity: { config: config.name, fingerprint: runFingerprint(config) },
    resume,
    sidecar: EVENTS_FILE,
  });

const ledger = (dir: string) => {
  const records: { key: string; hit: boolean; cost_usd: number }[] = [];
  forEachJsonl<{ key: string; hit: boolean; cost_usd: number }>(join(dir, "usage.jsonl"), (u) =>
    records.push(u),
  );
  return records;
};
const lines = (dir: string, file: string) =>
  readFileSync(join(dir, file), "utf8")
    .split("\n")
    .filter((l) => l.length > 0);

// The error messages pi-ai 1.3.0's openai-completions adapter writes for
// OpenRouter's documented error body {"error":{"code":<status>,"message":...}}:
// formatProviderError gives "<status>: <body>" when the SDK error carries the
// parsed body, and the openai SDK's own message is "<status> <message>".
const OVERFLOW_TEXT =
  'This endpoint\'s maximum context length is 163840 tokens. However, you requested about 201234 tokens (201234 of text input). Please reduce the length of either one, or use the "middle-out" transform to compress your prompt automatically.';
const OVERFLOW = `400: ${JSON.stringify({ message: OVERFLOW_TEXT, code: 400 })}`;
const OVERFLOW_SDK = `400 ${OVERFLOW_TEXT}`;
const STOPS: Record<401 | 402 | 403 | 404, string[]> = {
  401: [
    `401: ${JSON.stringify({ message: "No auth credentials found", code: 401 })}`,
    "401 User not found.",
  ],
  402: [
    `402: ${JSON.stringify({ message: "Insufficient credits. Add more using https://openrouter.ai/settings/credits", code: 402 })}`,
    // A credit error that names tokens and a limit must never read as an overflow.
    "402 This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 1200. To increase, visit https://openrouter.ai/settings/credits and upgrade to a paid account",
  ],
  403: [
    `403: ${JSON.stringify({ message: "Key limit exceeded (total limit). Manage it using https://openrouter.ai/settings/keys", code: 403 })}`,
    // A 403 that names moderation but lacks OpenRouter's moderation metadata still stops.
    "403 Your chosen model requires moderation and your input was flagged for: too many tokens of harassment",
  ],
  404: [
    // A pinned endpoint that is gone (R6's allow_fallbacks false), even if its text names the context.
    `404: ${JSON.stringify({ message: "No endpoints found matching your data policy (Paid model training). Configure: https://openrouter.ai/settings/privacy", code: 404 })}`,
    `404 ${OVERFLOW_TEXT}`,
  ],
};
// OpenRouter's documented moderation error: HTTP 403 with ModerationErrorMetadata
// (reasons, flagged_input, provider_name, model_slug). One prompt refused, not the key.
const MODERATION = `403: ${JSON.stringify({
  code: 403,
  message:
    'faux-live/model-1 requires moderation on OpenRouter. Your input was flagged for "harassment"',
  metadata: {
    reasons: ["harassment"],
    flagged_input: "You are a memory agent...",
    provider_name: "Faux",
    model_slug: "faux-live/model-1",
  },
})}`;

// pi-ai's openai-completions adapter maps a provider's `finish_reason:
// "content_filter"` (an output filter on this one prompt) to this message,
// with no status (mapStopReason).
const CONTENT_FILTER = "Provider finish_reason: content_filter";

const failed = (errorMessage: string) =>
  fauxAssistantMessage([], { stopReason: "error", errorMessage });

describe("how a failed answer call is read (the classifier)", () => {
  test("a 400 that says the prompt is over the context limit is a refusal, in either message shape", () => {
    expect(answerFailure(failed(OVERFLOW), JUDGE_RETRY)).toEqual({ kind: "refused" });
    expect(answerFailure(failed(OVERFLOW_SDK), JUDGE_RETRY)).toEqual({ kind: "refused" });
  });

  test("a 401, a 402, a 404 and a 403 that is not a moderation flag stop the run naming their status, whatever the text says", () => {
    for (const [status, messages] of Object.entries(STOPS)) {
      for (const message of messages) {
        expect(answerFailure(failed(message), JUDGE_RETRY), message).toEqual({
          kind: "halt",
          status: Number(status),
        });
      }
    }
    // A body whose code is a stopping status stops the run even under a 400 that reads as an overflow.
    const wrapped = `400: ${JSON.stringify({ message: OVERFLOW_TEXT, code: 402 })}`;
    expect(answerFailure(failed(wrapped), JUDGE_RETRY)).toEqual({ kind: "halt", status: 402 });
  });

  test("OpenRouter's moderation 403, with its documented metadata, is a refusal", () => {
    expect(answerFailure(failed(MODERATION), JUDGE_RETRY)).toEqual({ kind: "refused" });
  });

  test("pi-ai's content_filter finish is a moderation refusal of this prompt (the orchestrator's decision of 2026-11-27)", () => {
    expect(answerFailure(failed(CONTENT_FILTER), JUDGE_RETRY)).toEqual({ kind: "refused" });
    expect(answerFailure(failed(CONTENT_FILTER), undefined)).toEqual({ kind: "refused" });
    // Only that exact finish: another finish reason with no status still stops.
    expect(answerFailure(failed("Provider finish_reason: weird"), JUDGE_RETRY)).toEqual({
      kind: "stop",
    });
  });

  test("the classifier reads the status with retry.ts's one parse", () => {
    expect(
      [OVERFLOW, OVERFLOW_SDK, MODERATION, "HTTP 402 x", "Insufficient"].map(httpStatus),
    ).toEqual([400, 400, 403, 402, undefined]);
  });

  test("anything else is not a refusal: a plain 400, a transient status, a mid-stream error with no status, an abort", () => {
    // RV1's non-transient failure: it still stops the run (rv1.test.ts holds it).
    expect(answerFailure(failed("400 Bad Request"), JUDGE_RETRY)).toEqual({ kind: "stop" });
    // A transient status is the retry's, even when its text names tokens.
    expect(answerFailure(failed("429 Rate limit exceeded: too many tokens"), JUDGE_RETRY)).toEqual({
      kind: "transient",
    });
    expect(answerFailure(failed("503 maximum context length is 1 tokens"), JUDGE_RETRY)).toEqual({
      kind: "transient",
    });
    // OpenRouter's mid-stream error reaches pi-ai with no status: never excluded.
    expect(answerFailure(failed("Insufficient credits"), JUDGE_RETRY)).toEqual({ kind: "stop" });
    // An overflow text that also names credit or a key is not trusted as a refusal.
    expect(
      answerFailure(failed(`${OVERFLOW_TEXT} Add credits to raise the limit.`), JUDGE_RETRY),
    ).toEqual({ kind: "stop" });
    expect(answerFailure(fauxAssistantMessage([], { stopReason: "aborted" }), JUDGE_RETRY)).toEqual(
      { kind: "stop" },
    );
    // With no retry policy a transient status is a stop, as today.
    expect(answerFailure(failed("503 busy"), undefined)).toEqual({ kind: "stop" });
  });
});

describe("a refused answer call on GateMem", () => {
  test("excludes its session under `answer refused`, the next session runs, the summary counts it per condition, and its usage is paid once", async () => {
    const config = liveOf(two);
    const provider = fauxLive({ failures: [OVERFLOW], cost: 0.01 });
    const dir = fresh();
    const journal = journalFor(dir, config);
    const result = await runConfig(config, {
      ...liveOptions(config, provider.models, {}),
      journal,
      ...noWait,
    });
    journal.close();
    expect(result.sessions).toBe(2);
    const rows = lines(dir, "results.jsonl").map((l) => JSON.parse(l));
    expect(rows.map((r) => [r.condition, r.excluded])).toEqual([
      ["C2", "answer refused"],
      ["C3", undefined],
    ]);
    // A refused session is not judged.
    expect(rows[0].judge).toBeUndefined();
    expect(result.excluded).toEqual({ C2: { "answer refused": 1 } });
    expect(result.summary.C2?.n_checkpoints).toBe(0);
    expect(result.summary.C3?.n_checkpoints).toBe(1);
    const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
    expect(summary.excluded).toEqual({ C2: { "answer refused": 1 } });
    // One refused call and the next session's two: all three paid, all three recorded.
    expect(provider.state.calls).toBe(3);
    expect(readdirSync(config.cassettes)).toHaveLength(3);
    const paid = ledger(dir);
    expect(paid).toHaveLength(3);
    // Exactly one ledger line per call, the refused one included (review X20-6).
    expect(new Set(paid.map((u) => u.key)).size).toBe(3);
    expect(paid.every((u) => !u.hit && u.cost_usd === 0.01)).toBe(true);

    // The replay excludes the same session from its cassette, with zero calls.
    const replay = await runConfig(config, replayOptions(config));
    expect(replay.calls).toEqual({ new: 0, cached: 3 });
    expect(replay.rows.map((r) => r.excluded)).toEqual(["answer refused", undefined]);
    expect(replay.excluded).toEqual(result.excluded);
    expect(replay.summary).toEqual(result.summary);

    // The H1 converter counts it with the reasons it already counts (the
    // checkpoint is an access-control one, so it has an H1 violation).
    const converted = gatememSessions(replay.rows, { model: FAUX_MODEL, preset: "medium" });
    expect(converted.sessions.find((s) => s.condition === "C2")).toMatchObject({
      kind: "access",
      violation: null,
      exclusion: "answer refused",
    });
    expect(converted.exclusions).toEqual({ "answer refused": 1 });

    // The same refused session at a utility checkpoint carries its reason
    // into the H1 row's `exclusion`, with no utility verdict, so the H1
    // table counts it (research/analysis/h1.py, MGS's `utility_exclusions`).
    const [refusedRow, answeredRow] = replay.rows as [ProbeResult, ProbeResult];
    const asUtility = (row: ProbeResult): ProbeResult => ({
      ...row,
      score: { ...row.score, query_type: "utility" },
    });
    const utility = gatememSessions([asUtility(refusedRow), asUtility(answeredRow)], {
      model: FAUX_MODEL,
      preset: "medium",
    });
    expect(utility.sessions[0]).toMatchObject({
      kind: "utility",
      violation: null,
      exclusion: "answer refused",
      utility_ok: null,
    });
    expect(utility.sessions[1]).not.toHaveProperty("exclusion");
    // A turn-limited utility session gets no exclusion: card X21 counts it as `capped`.
    const capped = gatememSessions([{ ...asUtility(refusedRow), excluded: "turn limit" }], {
      model: FAUX_MODEL,
      preset: "medium",
    });
    expect(capped.sessions[0]).not.toHaveProperty("exclusion");
    expect(capped.sessions[0]).toMatchObject({ capped: true, utility_ok: null });
    // One session, one count: the refused utility row is never `capped`.
    expect(utility.sessions[0]).not.toHaveProperty("capped");
  }, 120_000);

  test("a transient failure before the refusal is retried, and every attempt's usage reaches the ledger", async () => {
    const config = liveOf({ ...two, conditions: ["C2"] as Condition[] });
    const provider = fauxLive({ failures: ["429 Too Many Requests", OVERFLOW_SDK], cost: 0.01 });
    const dir = fresh();
    const journal = journalFor(dir, config);
    const result = await runConfig(config, {
      ...liveOptions(config, provider.models, {}),
      journal,
      ...noWait,
    });
    journal.close();
    expect(result.excluded).toEqual({ C2: { "answer refused": 1 } });
    expect(provider.state.calls).toBe(2);
    // Both attempts paid under the one call's key; only the refusal is a cassette.
    const paid = ledger(dir);
    expect(paid).toHaveLength(2);
    expect(new Set(paid.map((u) => u.key)).size).toBe(1);
    expect(readdirSync(config.cassettes)).toHaveLength(1);
    const entry = JSON.parse(
      readFileSync(join(config.cassettes, readdirSync(config.cassettes)[0] as string), "utf8"),
    );
    expect(entry.response.text.startsWith(REFUSED_ANSWER_MARK)).toBe(true);
  }, 120_000);
});

describe("an HTTP 401, 402, 403 or 404 stops the run", () => {
  for (const status of [401, 402, 403, 404] as const) {
    test(`a ${status} stops the run naming its status, keeps the sessions before it, records nothing for its own, and a resume runs it`, async () => {
      const config = liveOf(two);
      // The first session answers (two calls); the second's first call is refused for the key or credit.
      const provider = fauxLive({
        failures: [undefined, undefined, STOPS[status][0] as string],
        cost: 0.01,
      });
      const dir = fresh();
      const journal = journalFor(dir, config);
      const stop = runConfig(config, {
        ...liveOptions(config, provider.models, {}),
        journal,
        sessionRetry: SESSION_RETRY,
        ...noWait,
      });
      await expect(stop).rejects.toThrow(new RegExp(`HTTP ${status}`));
      await expect(stop).rejects.toBeInstanceOf(ProviderStopError);
      journal.close();
      // Not retried by the outer session retry, and never a row or a cassette.
      expect(provider.state.calls).toBe(3);
      const kept = lines(dir, "results.jsonl").map((l) => JSON.parse(l));
      expect(kept.map((r) => [r.condition, r.excluded])).toEqual([["C2", undefined]]);
      expect(readdirSync(config.cassettes)).toHaveLength(2);
      // The refused attempt was paid for: its usage is in the ledger.
      expect(ledger(dir)).toHaveLength(3);

      // The key is fixed: RESUME=1 runs the stopped session.
      const fixed = fauxLive({ cost: 0.01 });
      const again = journalFor(dir, config, true);
      const rest = await runConfig(config, {
        ...liveOptions(config, fixed.models, {}),
        journal: again,
        ...noWait,
      });
      again.close();
      expect(rest.resumed).toBe(1);
      expect(rest.sessions).toBe(2);
      expect(fixed.state.calls).toBe(2);
      expect(rest.excluded).toBeUndefined();
      const all = lines(dir, "results.jsonl").map((l) => JSON.parse(l));
      expect(all.map((r) => [r.condition, r.excluded])).toEqual([
        ["C2", undefined],
        ["C3", undefined],
      ]);
    }, 120_000);
  }
});

describe("a stopping status at the judge stops the run too (review X20-1)", () => {
  const judged = { judge: { model: JUDGE_MODEL, temperature: 0, max_tokens: 4096 } };

  test("GateMem: a 402 at the judge stops the run, nothing recorded for it, no further judge call; a resume judges it", async () => {
    const config = liveOf({ ...two, conditions: ["C2"] as Condition[], ...judged });
    const dir = fresh();
    const broke = withJudge([{ error: STOPS[402][0] as string }], {
      answers: fauxLive({ cost: 0.01 }).models,
      cost: 0.01,
    });
    const first = journalFor(dir, config);
    await expect(
      runConfig(config, { ...liveOptions(config, broke.models, {}), journal: first, ...noWait }),
    ).rejects.toBeInstanceOf(ProviderStopError);
    first.close();
    // One judge call, not judgeOne's further attempts, and only the two answer calls are cassettes.
    expect(broke.asked).toHaveLength(1);
    expect(readdirSync(config.cassettes)).toHaveLength(2);
    expect(lines(dir, "results.jsonl")).toEqual([]);
    // The 402 attempt was paid for: two answer calls and the judge call.
    expect(ledger(dir)).toHaveLength(3);

    const VERDICT =
      '{"action_ok": true, "utility_ok": null, "privacy_leak": false, "deletion_leak": null, "notes": "ok"}';
    const healthy = withJudge([{ text: VERDICT }], { answers: fauxLive().models });
    const again = journalFor(dir, config, true);
    const result = await runConfig(config, {
      ...liveOptions(config, healthy.models, {}),
      journal: again,
      ...noWait,
    });
    again.close();
    expect(result.sessions).toBe(1);
    expect(result.calls).toEqual({ new: 1, cached: 2 });
  }, 120_000);

  test("LongMemEval: a 401 at the judge stops the run, unrecorded", async () => {
    const base = readLongMemEvalConfig(join(CONFIGS, "b5-longmemeval-plane.json"));
    const config = liveOf({
      ...base,
      items: ["66f24dbb"],
      conditions: ["C2"] as Condition[],
      store: "fake" as const,
      judge: { model: JUDGE_MODEL, temperature: 0, max_tokens: 10 },
    });
    const broke = withJudge([{ error: STOPS[401][1] as string }], { answers: fauxLive().models });
    await expect(
      runLongMemEvalConfig(config, { ...liveOptions(config, broke.models, {}), ...noWait }),
    ).rejects.toBeInstanceOf(ProviderStopError);
    expect(broke.asked).toHaveLength(1);
    // Only the answer calls are cassettes.
    expect(readdirSync(config.cassettes)).toHaveLength(2);
  }, 120_000);
});

describe("the backstop: five distinct items in a row refused stop the run (review X20-2, N1)", () => {
  /** The fixture's first checkpoints, each a distinct item. */
  const ITEMS = gatememItems(gatemem.loadDataset(b3.data)).slice(0, 6);

  test("one item refused in all its 12 sessions (4 conditions, 3 seeds) does not stop the run", async () => {
    expect(REFUSAL_STREAK_LIMIT).toBe(5);
    const config = liveOf({
      ...two,
      conditions: ["C2", "C3", "C4", "C5"] as Condition[],
      seeds: [1, 2, 3],
    });
    const provider = fauxLive({ failures: Array.from({ length: 12 }, () => OVERFLOW) });
    const result = await runConfig(config, {
      ...liveOptions(config, provider.models, {}),
      ...noWait,
    });
    expect(result.rows).toHaveLength(12);
    expect(result.rows.every((r) => r.excluded === "answer refused")).toBe(true);
    expect(provider.state.calls).toBe(12);
  }, 180_000);

  test("five distinct items in a row, each refused, stop the run at the fifth's refusal, unrecorded", async () => {
    const config = liveOf({ ...two, items: ITEMS, conditions: ["C2"] as Condition[] });
    const provider = fauxLive({ failures: Array.from({ length: 6 }, () => OVERFLOW) });
    const dir = fresh();
    const journal = journalFor(dir, config);
    const run = runConfig(config, {
      ...liveOptions(config, provider.models, {}),
      journal,
      sessionRetry: SESSION_RETRY,
      ...noWait,
    });
    await expect(run).rejects.toBeInstanceOf(RefusalStreak);
    await expect(run).rejects.toThrow(/5 distinct items in a row/);
    journal.close();
    expect(provider.state.calls).toBe(5);
    const kept = lines(dir, "results.jsonl").map((l) => JSON.parse(l));
    expect(kept.map((r) => r.item)).toEqual(ITEMS.slice(0, 4).map((i) => `gatemem/${i}`));
    expect(kept.every((r) => r.excluded === "answer refused")).toBe(true);
  }, 180_000);

  test("an item's answered sessions do not reset the count: refused under C2 and answered under C3, five items stop it", async () => {
    const config = liveOf({ ...two, items: ITEMS, conditions: ["C2", "C3"] as Condition[] });
    // Per item: C2's call refused, then C3's two calls answered.
    const provider = fauxLive({
      failures: ITEMS.flatMap(() => [OVERFLOW, undefined, undefined]),
    });
    const run = runConfig(config, { ...liveOptions(config, provider.models, {}), ...noWait });
    await expect(run).rejects.toBeInstanceOf(RefusalStreak);
    // Four whole items (three calls each), then the fifth item's refused call.
    expect(provider.state.calls).toBe(13);
  }, 180_000);

  test("an item none of whose sessions is refused resets the count", async () => {
    // Items 1 to 4 refused, item 5 answered, item 6 refused: never five in a row.
    const config = liveOf({ ...two, items: ITEMS, conditions: ["C2"] as Condition[] });
    const provider = fauxLive({
      failures: [OVERFLOW, OVERFLOW, OVERFLOW, OVERFLOW, undefined, undefined, OVERFLOW],
    });
    const result = await runConfig(config, {
      ...liveOptions(config, provider.models, {}),
      ...noWait,
    });
    expect(result.rows.map((r) => r.excluded)).toEqual([
      "answer refused",
      "answer refused",
      "answer refused",
      "answer refused",
      undefined,
      "answer refused",
    ]);
  }, 180_000);
});

describe("a moderation 403 on GateMem", () => {
  test("excludes its session as `answer refused`, and the run goes on", async () => {
    const config = liveOf(two);
    const provider = fauxLive({ failures: [MODERATION] });
    const result = await runConfig(config, {
      ...liveOptions(config, provider.models, {}),
      ...noWait,
    });
    expect(result.rows.map((r) => r.excluded)).toEqual(["answer refused", undefined]);
    expect(result.excluded).toEqual({ C2: { "answer refused": 1 } });
  }, 120_000);
});

describe("a content_filter finish on GateMem", () => {
  test("excludes its session as `answer refused`, replays with zero calls, and the run goes on", async () => {
    const config = liveOf(two);
    const provider = fauxLive({ failures: [CONTENT_FILTER] });
    const result = await runConfig(config, {
      ...liveOptions(config, provider.models, {}),
      ...noWait,
    });
    expect(result.rows.map((r) => r.excluded)).toEqual(["answer refused", undefined]);
    expect(result.excluded).toEqual({ C2: { "answer refused": 1 } });
    const replay = await runConfig(config, replayOptions(config));
    expect(replay.calls).toEqual({ new: 0, cached: 3 });
    expect(replay.excluded).toEqual(result.excluded);
  }, 120_000);
});

describe("the backstop counts every kind of refusal (the orchestrator's decision of 2026-11-27)", () => {
  const ITEMS = gatememItems(gatemem.loadDataset(b3.data)).slice(0, 6);
  test("five distinct items refused by an overflow, a moderation 403 and a content_filter finish stop the run", async () => {
    const config = liveOf({ ...two, items: ITEMS, conditions: ["C2"] as Condition[] });
    const provider = fauxLive({
      failures: [OVERFLOW, MODERATION, CONTENT_FILTER, OVERFLOW_SDK, CONTENT_FILTER, OVERFLOW],
    });
    const run = runConfig(config, { ...liveOptions(config, provider.models, {}), ...noWait });
    await expect(run).rejects.toBeInstanceOf(RefusalStreak);
    expect(provider.state.calls).toBe(5);
  }, 180_000);
});

describe("the backstop's count is per process: a resume starts it at zero (review finding 5)", () => {
  const ITEMS = gatememItems(gatemem.loadDataset(b3.data)).slice(0, 6);
  test("after a streak stop, a resume replays the five recorded refusals from the cassette and does not stop again", async () => {
    const config = liveOf({ ...two, items: ITEMS, conditions: ["C2"] as Condition[] });
    const provider = fauxLive({ failures: Array.from({ length: 5 }, () => OVERFLOW) });
    const dir = fresh();
    const journal = journalFor(dir, config);
    const stop = runConfig(config, {
      ...liveOptions(config, provider.models, {}),
      journal,
      ...noWait,
    });
    await expect(stop).rejects.toBeInstanceOf(RefusalStreak);
    journal.close();
    expect(provider.state.calls).toBe(5);
    // The fifth item's refusal was recorded before the stop (review finding 4).
    expect(readdirSync(config.cassettes)).toHaveLength(5);

    // The provider is fixed, but a resume asks none of the five again: the
    // fifth item's refusal replays from its cassette, and the count, starting
    // at zero, reaches one, so the run goes on to the sixth item.
    const fixed = fauxLive();
    const again = journalFor(dir, config, true);
    const rest = await runConfig(config, {
      ...liveOptions(config, fixed.models, {}),
      journal: again,
      ...noWait,
    });
    again.close();
    expect(rest.resumed).toBe(4);
    expect(fixed.state.calls).toBe(2);
    const all = lines(dir, "results.jsonl").map((l) => JSON.parse(l));
    expect(all.map((r) => r.excluded)).toEqual([
      "answer refused",
      "answer refused",
      "answer refused",
      "answer refused",
      "answer refused",
      undefined,
    ]);
  }, 180_000);
});

describe("a transient failure that outlasts the retry is unchanged (card RV1)", () => {
  test("it stops the session unrecorded, as a TransientCallError, even when its text names the context", async () => {
    const config = liveOf({ ...two, conditions: ["C2"] as Condition[] });
    const busy = "503 maximum context length is 1 tokens";
    const provider = fauxLive({ failures: [busy, busy, busy] });
    const run = runConfig(config, { ...liveOptions(config, provider.models, {}), ...noWait });
    await expect(run).rejects.toBeInstanceOf(TransientCallError);
    expect(provider.state.calls).toBe(3);
    expect(readdirSync(config.cassettes)).toHaveLength(0);
  }, 60_000);
});

describe("the session's end, read from its messages and its cassette", () => {
  const refusal = new AnswerRefused("model call failed: 400 ...");
  const ended = [
    { role: "user" },
    { role: "assistant", stopReason: "error", errorMessage: "400 ..." },
  ];
  test("a refusal that ended the session is an exclusion, not a failure; sessionFailure still calls it one", () => {
    expect(sessionEnd(ended, { errors: [refusal], capped: false }, "gatemem/x")).toEqual({
      excluded: "answer refused",
    });
    // Other callers (D3's replay validation) keep reading it as a failure.
    expect(sessionFailure(ended, { errors: [refusal], capped: false })).toBe(refusal);
    expect(sessionEnd(ended, { errors: [], capped: true }, "gatemem/x")).toEqual({
      excluded: "turn limit",
    });
    const other = new Error("model call failed: 400 Bad Request");
    expect(sessionEnd(ended, { errors: [other], capped: false }, "gatemem/x")).toEqual({
      failure: other,
    });
    expect(
      sessionEnd(
        [...ended, { role: "assistant", stopReason: "stop" }],
        {
          errors: [refusal],
          capped: false,
        },
        "gatemem/x",
      ),
    ).toEqual({});
  });
});

describe("a refused answer call on MEM-INV-Bench and LongMemEval", () => {
  test("MEM-INV-Bench: the session is excluded under its reason, counted per condition, replayed with zero calls", async () => {
    const config = liveOf({ ...readMemInvConfig(B4), conditions: ["C2", "C5"] as Condition[] });
    const provider = fauxLive({ failures: [OVERFLOW] });
    const result = await runMemInvConfig(config, {
      ...liveOptions(config, provider.models, {}),
      ...noWait,
    });
    expect(result.rows.map((r) => r.excluded)).toEqual(["answer refused", undefined]);
    expect(result.excluded).toEqual({ C2: { "answer refused": 1 } });
    expect(result.summary.C2?.sessions).toBe(0);
    expect(result.summary.C5?.sessions).toBe(1);
    expect(memInvViolation(result.rows[0] as (typeof result.rows)[number])).toEqual({
      violation: null,
      exclusion: "answer refused",
    });
    const replay = await runMemInvConfig(config, replayOptions(config));
    expect(replay.calls).toEqual({ new: 0, cached: result.calls.new });
    expect(replay.rows).toEqual(result.rows);
    expect(replay.excluded).toEqual(result.excluded);
  }, 120_000);

  test("LongMemEval: the session is excluded and not judged", async () => {
    const base = readLongMemEvalConfig(join(CONFIGS, "b5-longmemeval-plane.json"));
    const config = liveOf({
      ...base,
      items: ["66f24dbb"],
      conditions: ["C2"] as Condition[],
      store: "fake" as const,
      judge: { model: JUDGE_MODEL, temperature: 0, max_tokens: 10 },
    });
    const judge = withJudge([{ text: "yes" }], {
      answers: fauxLive({ failures: [OVERFLOW] }).models,
    });
    const result = await runLongMemEvalConfig(config, {
      ...liveOptions(config, judge.models, {}),
      ...noWait,
    });
    expect(result.rows.map((r) => r.excluded)).toEqual(["answer refused"]);
    expect(result.rows[0]?.judge).toBeNull();
    expect(judge.asked).toEqual([]);
    expect(result.excluded).toEqual({ C2: { "answer refused": 1 } });
    expect(result.summary.C2?.sessions).toBe(0);
  }, 120_000);
});
