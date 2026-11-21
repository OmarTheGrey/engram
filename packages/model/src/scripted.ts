// Scripted models for tests. No test reaches a real provider: a scripted
// model answers from a fixed script and fails loudly when the script is
// exhausted (docs/conventions/testing.md, "Models are scripted, not mocked").
import {
  type AssistantMessage,
  type FauxResponseFactory,
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
  type ToolCall,
  type TranscriptContext,
} from "@earendil-works/pi-ai";
import { type ModelCall, type ModelRequest, requestHash } from "@engram/core";
import type { ChatCall, ChatResponse } from "./cached.ts";

type ScriptedToolCall = { id: string; name: string; arguments: ToolCall["arguments"] };

/** One model answer: a tool call, several tool calls in one message, or text. */
export type ScriptStep =
  | { toolCall: ScriptedToolCall }
  | { toolCalls: readonly ScriptedToolCall[] }
  | { text: string };

export interface ScriptedPiModelOptions {
  provider?: string;
  model?: string;
  /** API id. Fixed so transcripts are stable; pi-ai's default embeds a timestamp. */
  api?: string;
}

/**
 * A pi-ai provider and model that replay `steps` in order, one per model call.
 * Register `provider` on a model runtime (`registerNativeProvider`) or a
 * `Models` collection (`setProvider`). `seen` holds the transcript sent on each
 * call, so a test can assert what reached the model.
 */
export function scriptedPiModel(
  steps: readonly ScriptStep[],
  options: ScriptedPiModelOptions = {},
) {
  const faux = fauxProvider({
    api: options.api ?? "scripted",
    provider: options.provider ?? "scripted",
    models: [{ id: options.model ?? "scripted-1" }],
  });
  const seen: TranscriptContext[] = [];
  const respond =
    (step: ScriptStep): FauxResponseFactory =>
    (context): AssistantMessage => {
      seen.push(structuredClone(context));
      if ("text" in step) return fauxAssistantMessage(step.text);
      const calls = "toolCalls" in step ? step.toolCalls : [step.toolCall];
      return fauxAssistantMessage(
        calls.map(({ id, name, arguments: args }) => fauxToolCall(name, args, { id })),
        { stopReason: "toolUse" },
      );
    };
  faux.setResponses(steps.map(respond));
  return {
    provider: faux.provider,
    model: faux.getModel(),
    seen,
    remaining: () => faux.getPendingResponseCount(),
  };
}

export type ScriptedPiModel = ReturnType<typeof scriptedPiModel>;

/**
 * A ModelCall that answers from a table keyed on `requestHash(request)` and
 * throws on any request the table does not hold, naming its hash so the test
 * author can add it.
 */
export function scriptedModelCall(table: Readonly<Record<string, string>>): ModelCall {
  return async (request) => {
    const hash = requestHash(request);
    const text = table[hash];
    if (text === undefined) {
      throw new Error(
        `scripted model has no answer for request ${hash} (model ${request.model}, seed ${request.seed}); add it to the table`,
      );
    }
    return { text, usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 } };
  };
}

/**
 * The brand on a scripted upstream (verification V-1): a non-enumerable
 * symbol property, so the cassette proxy can tell a scripted upstream, whose
 * cassettes `make fixtures` may write into `fixtures/`, from any other one.
 */
const SCRIPTED: unique symbol = Symbol("engram.scripted-chat-call");

/**
 * Brands `call` as a scripted upstream and returns it (the same function).
 * The cassette proxy records fixture cassettes (`recordFixtures`, under
 * ENGRAM_UPDATE_FIXTURES=1) only from a branded upstream. `scriptedChatCall`
 * brands its calls; a harness's own scripted agent (MERIT's, tau2-bench's) is
 * wrapped in `asScripted` to record its fixtures. Brand only a call that
 * answers from a fixed script and reaches no model: the brand is the
 * caller's promise, and a branded live call would write paid replies into
 * `fixtures/` as goldens. A wrapper around a branded call is not branded.
 */
export function asScripted<F extends ChatCall>(call: F): F {
  Object.defineProperty(call, SCRIPTED, { value: true, enumerable: false });
  return call;
}

/** Whether `call` was branded by `asScripted` (as every `scriptedChatCall` is). */
export const isScripted = (call: unknown): boolean =>
  typeof call === "function" && (call as { [SCRIPTED]?: unknown })[SCRIPTED] === true;

/** `isScripted`, under the name the first verification pass exported. */
export const isScriptedChatCall = isScripted;

/** A scripted reply that may call tools: text, or text with OpenAI tool calls. */
export type ScriptedChatReply = string | Pick<ChatResponse, "text" | "toolCalls" | "finishReason">;

/**
 * A ChatCall for the cassette proxy's tests (card B10): as `scriptedModelCall`,
 * keyed on the hash of the whole request (tool definitions included), and a
 * reply may carry tool calls. It costs nothing. The call is branded with
 * `asScripted`.
 */
export function scriptedChatCall(table: Readonly<Record<string, ScriptedChatReply>>): ChatCall {
  const call: ChatCall = async (request) => {
    const hash = requestHash(request as ModelRequest);
    const reply = table[hash];
    if (reply === undefined) {
      throw new Error(
        `scripted model has no answer for request ${hash} (model ${request.model}, seed ${request.seed}); add it to the table`,
      );
    }
    const usage = { input_tokens: 0, output_tokens: 0, cost_usd: 0 };
    return typeof reply === "string" ? { text: reply, usage } : { ...reply, usage };
  };
  return asScripted(call);
}
