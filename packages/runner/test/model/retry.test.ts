// Retrying a live call's transient failures as the benchmarks' own clients do
// (PR #25 review round 3, V-4): MEM-INV-Bench's driver for the agent note,
// GateMem's router for the judge. The sleep is injected, so the waits are
// checked, not waited.
import { type AssistantMessage, fauxAssistantMessage, fauxText } from "@earendil-works/pi-ai";
import { describe, expect, test } from "vitest";
import { isTransient, JUDGE_RETRY, NOTE_RETRY, withRetry } from "../../src/model/retry.ts";

const failed = (errorMessage: string): AssistantMessage =>
  fauxAssistantMessage(fauxText(""), { stopReason: "error", errorMessage });
const ok = (text: string): AssistantMessage => fauxAssistantMessage(fauxText(text));

/** A call answering from `replies` in order, and the waits it was made to sleep. */
function scripted(replies: AssistantMessage[]) {
  const slept: number[] = [];
  let calls = 0;
  return {
    once: async () => replies[calls++] as AssistantMessage,
    sleep: async (ms: number) => {
      slept.push(ms);
    },
    slept,
    calls: () => calls,
  };
}

describe("which failures are transient", () => {
  test.each([
    ["429 Rate limit exceeded", true, true],
    ['502: {"error":{"message":"Bad gateway"}}', true, true],
    ["HTTP 503", true, true],
    ["524 A timeout occurred", true, false],
    ["504 Gateway Timeout", false, true],
    ["500 Internal Server Error", true, true],
    ['400: {"error":{"message":"bad request"}}', false, false],
    ["401 Unauthorized", false, false],
    ["Connection error.", true, true],
    ["Request timed out.", true, true],
    ["fetch failed: ECONNRESET", true, true],
    ["Provider finish_reason: network_error", false, false],
    ["No API key for provider: openrouter", false, false],
  ] as const)("%s: note %s, judge %s", (message, note, judge) => {
    expect(isTransient(message, NOTE_RETRY)).toBe(note);
    expect(isTransient(message, JUDGE_RETRY)).toBe(judge);
  });

  test("an error without a message is not transient", () => {
    expect(isTransient(undefined, NOTE_RETRY)).toBe(false);
  });
});

describe("withRetry", () => {
  test("a call that fails twice and then answers is answered on the third attempt, after waits of 1 and 2 seconds", async () => {
    const s = scripted([failed("429 Rate limit"), failed("502: bad gateway"), ok("the note")]);
    const { reply, attempts } = await withRetry(s.once, NOTE_RETRY, s.sleep);
    expect(reply.stopReason).toBe("stop");
    expect(attempts).toBe(3);
    expect(s.slept).toEqual([1000, 2000]);
  });

  test("the note gives up after four attempts, the judge after three, returning the last failure", async () => {
    const note = scripted([1, 2, 3, 4, 5].map(() => failed("503 busy")));
    const n = await withRetry(note.once, NOTE_RETRY, note.sleep);
    expect([n.attempts, n.reply.stopReason, note.calls()]).toEqual([4, "error", 4]);
    expect(note.slept).toEqual([1000, 2000, 4000]);
    const judge = scripted([1, 2, 3, 4].map(() => failed("503 busy")));
    const j = await withRetry(judge.once, JUDGE_RETRY, judge.sleep);
    expect([j.attempts, j.reply.stopReason, judge.calls()]).toEqual([3, "error", 3]);
    expect(judge.slept).toEqual([1000, 2000]);
  });

  test("the waits are capped as upstream caps them", () => {
    expect([0, 1, 4, 5, 9].map(NOTE_RETRY.delayMs)).toEqual([1000, 2000, 16000, 20000, 20000]);
    expect([0, 3, 4].map(JUDGE_RETRY.delayMs)).toEqual([1000, 8000, 10000]);
  });

  test("a failure that is not transient, an aborted call and an answer are not retried", async () => {
    for (const first of [
      failed("400: bad request"),
      fauxAssistantMessage(fauxText(""), { stopReason: "aborted" }),
      ok("fine"),
    ]) {
      const s = scripted([first, ok("never asked")]);
      const { reply, attempts } = await withRetry(s.once, NOTE_RETRY, s.sleep);
      expect([attempts, reply, s.slept]).toEqual([1, first, []]);
    }
  });
});
