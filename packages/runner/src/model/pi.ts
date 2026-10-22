// A ModelCall on pi-ai. In a pi session pass the session's model runtime; in
// the runner pass a Models collection. pi-ai exposes no sampling seed, so the
// seed only separates cache entries (one sample per seed), which is what
// ADR 0016 and ADR 0017 need.
import type { Api, AssistantMessage, Context, Model } from "@earendil-works/pi-ai";
import type { ModelCall } from "@engram/core";

export interface CompletesSimple {
  completeSimple(model: Model<Api>, context: Context, options?: object): Promise<AssistantMessage>;
}

export function piModelCall(
  models: CompletesSimple,
  resolve: (name: string) => Model<Api>,
): ModelCall {
  return async (request) => {
    const messages = request.messages.map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.content, timestamp: 0 }
        : ({ role: "assistant", content: [{ type: "text", text: m.content }] } as never),
    );
    const context: Context =
      request.system === undefined ? { messages } : { systemPrompt: request.system, messages };
    const reply = await models.completeSimple(resolve(request.model), context, {
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.maxTokens === undefined ? {} : { maxTokens: request.maxTokens }),
    });
    if (reply.stopReason === "error" || reply.stopReason === "aborted") {
      throw new Error(`model call failed: ${reply.errorMessage ?? reply.stopReason}`);
    }
    return {
      text: reply.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join(""),
      usage: {
        input_tokens: reply.usage.input,
        output_tokens: reply.usage.output,
        cost_usd: reply.usage.cost.total,
      },
    };
  };
}
