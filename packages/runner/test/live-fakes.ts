// Fake live providers for card RV1's tests: pi-ai's faux provider on the
// seeded API for the answer model, and a scripted judge or lint model, each
// reporting a set cost per call as a live provider does. Nothing here
// reaches the network.
import { createHash } from "node:crypto";
import type { Api, AssistantMessage, Context, Model } from "@earendil-works/pi-ai";
import {
  createModels,
  type FauxResponseFactory,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import type { LiveModels } from "../src/answers.ts";

/** No built-in pi-ai provider is called this, so a regressed guard reaches no one. */
export const FAUX_MODEL = "faux-live/model-1";
export const ANSWER =
  '{"action":"refuse","answer":"No.","answer_structured":{},"used_record_ids":[]}';
/** The judge and lint model the fakes serve, on OpenRouter's seeded API. */
export const JUDGE_MODEL = "openrouter/openai/gpt-4o";

export const usage = (cost: number): AssistantMessage["usage"] => ({
  input: 10,
  output: 5,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 15,
  cost: { input: cost / 2, output: cost / 2, cacheRead: 0, cacheWrite: 0, total: cost },
});

/**
 * A faux live provider on the seeded API: the first replies are `failures`
 * (pi-ai error messages; an undefined one answers as usual, card X20), then
 * a memory_read, then the answer once a read came back; with `loop`, a
 * memory_read every time. Each reply costs `cost`.
 */
export function fauxLive(
  options: {
    failures?: (string | undefined)[];
    cost?: number;
    loop?: boolean;
    answer?: string;
    /** Tool call ids from the session's user messages rather than at random (card RV6). */
    stableIds?: boolean;
  } = {},
) {
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
    return last?.role === "toolResult" && !options.loop
      ? fauxAssistantMessage(fauxText(options.answer ?? ANSWER))
      : fauxAssistantMessage(
          fauxToolCall(
            "memory_read",
            { query: "Monsoon" },
            options.stableIds ? { id: stableId(context) } : {},
          ),
          { stopReason: "toolUse" },
        );
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

/**
 * A tool call id that depends only on the session's user messages, so the
 * same session gets the same id in any process (pi-ai's faux provider draws
 * one at random, as a live model's ids are its own).
 */
const stableId = (context: Context): string =>
  `tool-${createHash("sha256")
    .update(JSON.stringify(context.messages.flatMap((m) => (m.role === "user" ? [m.content] : []))))
    .digest("hex")
    .slice(0, 16)}`;

/** One reply of the judge or lint model: its text, or a failure with pi-ai's error message. */
export type JudgeReply = { text: string } | { error: string };

/**
 * `answers` (when given) for the answer model, and JUDGE_MODEL answering with
 * `replies` in order (the last one again once they run out), each at `cost`.
 */
export function withJudge(
  replies: JudgeReply[],
  options: { answers?: LiveModels; cost?: number } = {},
) {
  const judge = {
    id: "openai/gpt-4o",
    provider: "openrouter",
    api: "openai-completions",
  } as unknown as Model<Api>;
  const asked: Context[] = [];
  const models: LiveModels = {
    getModel: (provider, id) =>
      provider === "openrouter" && id === "openai/gpt-4o"
        ? judge
        : options.answers?.getModel(provider, id),
    async completeSimple(model, context, stream) {
      if (model.provider !== "openrouter") {
        if (!options.answers) throw new Error(`no answer model ${model.provider}`);
        return options.answers.completeSimple(model, context, stream);
      }
      asked.push(context);
      const reply = replies[Math.min(asked.length, replies.length) - 1] as JudgeReply;
      return {
        role: "assistant",
        content: [{ type: "text", text: "text" in reply ? reply.text : "" }],
        api: "openai-completions",
        provider: "openrouter",
        model: "openai/gpt-4o",
        usage: usage(options.cost ?? 0),
        stopReason: "text" in reply ? "stop" : "error",
        ...("error" in reply ? { errorMessage: reply.error } : {}),
        timestamp: 0,
      } as AssistantMessage;
    },
  };
  return { models, asked };
}
