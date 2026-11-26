// Card X20 (pre-tag condition 3, lead-decisions item 14): an answer call the
// provider refused with an error no retry can fix (a prompt over the
// context limit) excludes that session under its own reason, `answer
// refused`, counted per condition, and the run goes on; an HTTP 401, 402 or
// 403 stops the run, names its status, records nothing for that session,
// and a resume runs it once the key or credit is fixed. A replay excludes
// the same session from its cassette with zero calls. pi-ai's faux provider
// stands in for OpenRouter on the seeded API, answering with error messages
// in the shapes pi-ai 1.3.0 gives OpenRouter's documented error bodies;
// nothing here reaches the network, and every wait is injected.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { TransientCallError } from "@engram/model";
import { afterAll, describe, expect, test } from "vitest";
import { type Condition, readRunnerConfig } from "../src/config.ts";
import { forEachJsonl, RunJournal, runFingerprint } from "../src/journal.ts";
import { liveConfig, liveOptions, replayOptions } from "../src/live.ts";
import { readLongMemEvalConfig, runLongMemEvalConfig } from "../src/longmemeval-probe.ts";
import { readMemInvConfig, runMemInvConfig } from "../src/mem-inv-probe.ts";
import {
  AnswerRefused,
  answerFailure,
  ProviderAccountError,
  REFUSED_ANSWER_MARK,
  sessionEnd,
  sessionFailure,
} from "../src/model/cassette.ts";
import { JUDGE_RETRY, SESSION_RETRY } from "../src/model/retry.ts";
import { gatememSessions, memInvViolation } from "../src/research/h1-sessions.ts";
import { EVENTS_FILE, runConfig } from "../src/run.ts";
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
  "This endpoint's maximum context length is 163840 tokens. However, you requested about 201234 tokens (201234 of text input). Please reduce the length of either one, or use the \"middle-out\" transform to compress your prompt automatically.";
const OVERFLOW = `400: ${JSON.stringify({ message: OVERFLOW_TEXT, code: 400 })}`;
const OVERFLOW_SDK = `400 ${OVERFLOW_TEXT}`;
const ACCOUNT: Record<401 | 402 | 403, string[]> = {
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
    "403 Your chosen model requires moderation and your input was flagged for: too many tokens of harassment",
  ],
};

const failed = (errorMessage: string) =>
  fauxAssistantMessage([], { stopReason: "error", errorMessage });

describe("how a failed answer call is read (the classifier)", () => {
  test("a 400 that says the prompt is over the context limit is a refusal, in either message shape", () => {
    expect(answerFailure(failed(OVERFLOW), JUDGE_RETRY)).toEqual({ kind: "refused" });
    expect(answerFailure(failed(OVERFLOW_SDK), JUDGE_RETRY)).toEqual({ kind: "refused" });
  });

  test("a 401, a 402 and a 403 are account stops naming their status, whatever the text says", () => {
    for (const [status, messages] of Object.entries(ACCOUNT)) {
      for (const message of messages) {
        expect(answerFailure(failed(message), JUDGE_RETRY), message).toEqual({
          kind: "account",
          status: Number(status),
        });
      }
    }
    // A body whose code is an account status stops the run even under a 400 that reads as an overflow.
    const wrapped = `400: ${JSON.stringify({ message: OVERFLOW_TEXT, code: 402 })}`;
    expect(answerFailure(failed(wrapped), JUDGE_RETRY)).toEqual({ kind: "account", status: 402 });
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
    // A 404 (no endpoint) would hit every session: it stops, as before.
    expect(answerFailure(failed(`404 ${OVERFLOW_TEXT}`), JUDGE_RETRY)).toEqual({ kind: "stop" });
    expect(
      answerFailure(fauxAssistantMessage([], { stopReason: "aborted" }), JUDGE_RETRY),
    ).toEqual({ kind: "stop" });
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
    expect(new Set(paid.map((u) => u.key)).size).toBe(3);
    expect(paid.every((u) => !u.hit && u.cost_usd === 0.01)).toBe(true);

    // The replay excludes the same session from its cassette, with zero calls.
    const replay = await runConfig(config, replayOptions(config));
    expect(replay.calls).toEqual({ new: 0, cached: 3 });
    expect(replay.rows.map((r) => r.excluded)).toEqual(["answer refused", undefined]);
    expect(replay.excluded).toEqual(result.excluded);
    expect(replay.summary).toEqual(result.summary);

    // The H1 converter counts it with the reasons it already counts.
    const converted = gatememSessions(replay.rows, { model: FAUX_MODEL, preset: "medium" });
    const refused = converted.sessions.find((s) => s.condition === "C2");
    if (refused?.kind === "utility") {
      expect(refused.utility_ok).toBeNull();
    } else {
      expect(refused).toMatchObject({ violation: null, exclusion: "answer refused" });
      expect(converted.exclusions).toEqual({ "answer refused": 1 });
    }
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

describe("an HTTP 401, 402 or 403 stops the run", () => {
  for (const status of [401, 402, 403] as const) {
    test(`a ${status} stops the run naming its status, keeps the sessions before it, records nothing for its own, and a resume runs it`, async () => {
      const config = liveOf(two);
      // The first session answers (two calls); the second's first call is refused for the key or credit.
      const provider = fauxLive({
        failures: [undefined, undefined, ACCOUNT[status][0] as string],
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
      await expect(stop).rejects.toBeInstanceOf(ProviderAccountError);
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
    expect(sessionEnd(ended, { errors: [refusal], capped: false })).toEqual({
      excluded: "answer refused",
    });
    // Other callers (D3's replay validation) keep reading it as a failure.
    expect(sessionFailure(ended, { errors: [refusal], capped: false })).toBe(refusal);
    expect(sessionEnd(ended, { errors: [], capped: true })).toEqual({ excluded: "turn limit" });
    const other = new Error("model call failed: 400 Bad Request");
    expect(sessionEnd(ended, { errors: [other], capped: false })).toEqual({ failure: other });
    expect(
      sessionEnd([...ended, { role: "assistant", stopReason: "stop" }], {
        errors: [refusal],
        capped: false,
      }),
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
