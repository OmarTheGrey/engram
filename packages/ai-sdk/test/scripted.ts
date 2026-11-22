// A scripted language model for the middleware's tests (card E8.14; AGENTS.md
// rule 15, a fake and not a mock): a LanguageModelV4 that answers each call
// with the next scripted turn and records the call options it was given, so
// a test sees exactly the prompt the middleware produced. It fails loudly
// when the script runs out. `step` applies the middleware as the AI SDK's
// wrapLanguageModel does for a generate or stream call (transformParams,
// then the model), with no other package.
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4GenerateResult,
  LanguageModelV4Middleware,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";

const USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

export interface ScriptedModel extends LanguageModelV4 {
  /** The call options of every call, in order. */
  calls: LanguageModelV4CallOptions[];
}

export function scriptedModel(turns: LanguageModelV4Content[][]): ScriptedModel {
  const calls: LanguageModelV4CallOptions[] = [];
  const next = (options: LanguageModelV4CallOptions): LanguageModelV4Content[] => {
    calls.push(options);
    const turn = turns[calls.length - 1];
    if (turn === undefined) throw new Error(`scripted model: no turn ${calls.length} scripted`);
    return turn;
  };
  const result = (content: LanguageModelV4Content[]): LanguageModelV4GenerateResult => ({
    content,
    finishReason: {
      unified: content.some((c) => c.type === "tool-call") ? "tool-calls" : "stop",
      raw: undefined,
    },
    usage: USAGE,
    warnings: [],
  });
  return {
    specificationVersion: "v4",
    provider: "scripted",
    modelId: "scripted",
    supportedUrls: {},
    calls,
    doGenerate: async (options) => result(next(options)),
    doStream: async (options) => {
      const content = next(options);
      const parts: LanguageModelV4StreamPart[] = content.flatMap(
        (c): LanguageModelV4StreamPart[] =>
          c.type === "text"
            ? [
                { type: "text-start", id: "0" },
                { type: "text-delta", id: "0", delta: c.text },
                { type: "text-end", id: "0" },
              ]
            : [],
      );
      parts.push({ type: "finish", finishReason: result(content).finishReason, usage: USAGE });
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const p of parts) controller.enqueue(p);
            controller.close();
          },
        }),
      };
    },
  };
}

/** One model call through the middleware, as wrapLanguageModel makes it. */
export async function step(
  model: LanguageModelV4,
  middleware: LanguageModelV4Middleware,
  params: LanguageModelV4CallOptions,
  type: "generate" | "stream" = "generate",
) {
  const transformed = middleware.transformParams
    ? await middleware.transformParams({ type, params, model })
    : params;
  return type === "generate" ? model.doGenerate(transformed) : model.doStream(transformed);
}
