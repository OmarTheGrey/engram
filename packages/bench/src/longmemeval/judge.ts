// LongMemEval's answer judge, ported from upstream at commit 9e0b455 (card B5):
// src/evaluation/evaluate_qa.py sends get_anscheck_prompt as one user message
// to gpt-4o-2024-08-06 with n 1, temperature 0 and max_tokens 10, strips the
// reply and labels the answer correct when "yes" is in it, lower-cased.
// Derived from LongMemEval, MIT licence, Copyright (c) 2024 Di Wu; see
// fixtures/bench/longmemeval/UPSTREAM-LICENSE. The plane never calls a model:
// the call is injected (AGENTS.md rule 4), cached and seeded (ADR 0017).
import type { ModelCall, ModelRequest } from "@engram/core";
import { renderJudgePrompt } from "./prompt.ts";
import type { Question } from "./schema.ts";

/** The paper's judge (evaluate_qa.py model_zoo['gpt-4o'], print_qa_metrics.py's assertion). */
export const PAPER_JUDGE = {
  model: "openai/gpt-4o-2024-08-06",
  temperature: 0,
  maxTokens: 10,
} as const;

export interface JudgeSettings {
  /** `provider/model-id`. */
  model: string;
  /** From the config; part of the cache key (AGENTS.md rule 6). */
  seed: number;
  temperature: number;
  maxTokens: number;
}

export const judgeRequest = (prompt: string, s: JudgeSettings): ModelRequest => ({
  model: s.model,
  messages: [{ role: "user", content: prompt }],
  seed: s.seed,
  temperature: s.temperature,
  maxTokens: s.maxTokens,
});

/** Upstream's label: `'yes' in eval_response.lower()`, after strip(). */
export const judgeLabel = (reply: string) => reply.trim().toLowerCase().includes("yes");

export interface JudgeVerdict {
  question_id: string;
  /** The judge's raw reply, stripped. */
  reply: string;
  label: boolean;
}

/** Judge one hypothesis for one question. */
export async function judgeAnswer(
  call: ModelCall,
  q: Question,
  hypothesis: string,
  settings: JudgeSettings,
): Promise<JudgeVerdict> {
  const response = await call(judgeRequest(renderJudgePrompt(q, hypothesis), settings));
  const reply = response.text.trim();
  return { question_id: q.question_id, reply, label: judgeLabel(reply) };
}

/** A scripted judge's replies, by question id: a pipeline check, never a result. */
export type JudgeScript = Readonly<Record<string, string>>;

/** A ModelCall answering one question's judge request from the script; unknown ids fail loudly. */
export function scriptedJudge(script: JudgeScript, questionId: string): ModelCall {
  return async (request) => {
    const reply = script[questionId];
    if (reply === undefined) {
      throw new Error(`scripted judge has no reply for ${questionId} (model ${request.model})`);
    }
    return { text: reply, usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
  };
}
