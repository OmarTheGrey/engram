import type { ModelRequest } from "@engram/core";
import { describe, expect, test } from "vitest";
import {
  judgeAnswer,
  judgeLabel,
  judgeRequest,
  PAPER_JUDGE,
  scriptedJudge,
} from "../../src/longmemeval/judge.ts";
import { renderJudgePrompt } from "../../src/longmemeval/prompt.ts";
import { questions } from "./fixture.ts";

const settings = { ...PAPER_JUDGE, seed: 1 };

describe("the LongMemEval judge", () => {
  test("labels a reply correct when it contains yes, lower-cased after strip, as upstream does", () => {
    expect(judgeLabel("Yes.")).toBe(true);
    expect(judgeLabel("  YES\n")).toBe(true);
    expect(judgeLabel("no")).toBe(false);
    // Upstream's substring rule, kept as is: "yes" inside another word counts.
    expect(judgeLabel("yesterday")).toBe(true);
  });

  test("sends upstream's request: one user message, temperature 0, at most 10 tokens, the config's seed", () => {
    const req = judgeRequest("p", settings);
    expect(req).toEqual({
      model: "openai/gpt-4o-2024-08-06",
      messages: [{ role: "user", content: "p" }],
      seed: 1,
      temperature: 0,
      maxTokens: 10,
    });
  });

  test("judges one hypothesis through the injected call with the question's prompt", async () => {
    const q = questions[0];
    if (!q) throw new Error("no fixture question");
    const seen: ModelRequest[] = [];
    const verdict = await judgeAnswer(
      async (r) => {
        seen.push(r);
        return { text: " yes ", usage: { input_tokens: 1, output_tokens: 1, cost_usd: 0 } };
      },
      q,
      "an answer",
      settings,
    );
    expect(verdict).toEqual({ question_id: q.question_id, reply: "yes", label: true });
    expect(seen[0]?.messages[0]?.content).toBe(renderJudgePrompt(q, "an answer"));
  });

  test("a scripted judge answers from its script and fails loudly on an unknown question", async () => {
    const r = await scriptedJudge({ a: "no" }, "a")(judgeRequest("p", settings));
    expect(r.text).toBe("no");
    await expect(scriptedJudge({}, "b")(judgeRequest("p", settings))).rejects.toThrow(
      "scripted judge has no reply for b",
    );
  });
});
