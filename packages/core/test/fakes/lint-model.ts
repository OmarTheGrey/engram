// A scripted ModelCall for the model-based lints (card L3), in the manner of
// @engram/model's scriptedModelCall (testing convention, "Models are
// scripted, not mocked"), kept here so core's tests import no pi-ai. It
// answers from a function of the lint (by the request's response schema), the
// input the lint sent (its one user message, parsed) and the seed, and it
// records every request it received.
import type { ModelCall, ModelRequest, ModelUsage } from "../../src/model.ts";

export interface ScriptedLintModel {
  call: ModelCall;
  requests: ModelRequest[];
}

export const USAGE: ModelUsage = { input_tokens: 120, output_tokens: 18, cost_usd: 0.0004 };

export function scriptedLintModel(
  answer: (lint: string, input: Record<string, unknown>, seed: number) => string,
): ScriptedLintModel {
  const requests: ModelRequest[] = [];
  return {
    requests,
    call: async (request) => {
      requests.push(request);
      const lint = (request.responseSchema?.name ?? "").replace(/^engram_lint_/, "");
      const input = JSON.parse(request.messages.at(-1)?.content ?? "null") as Record<
        string,
        unknown
      >;
      return { text: answer(lint, input, request.seed), usage: USAGE };
    },
  };
}

/** A reply in the lints' answer shape. */
export const reply = (verdict: string, reason = "scripted reason") =>
  JSON.stringify({ verdict, reason });
