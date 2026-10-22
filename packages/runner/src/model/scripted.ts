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
import { type ModelCall, requestHash } from "@engram/core";

export type ScriptStep =
  | { toolCall: { id: string; name: string; arguments: ToolCall["arguments"] } }
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
      const { id, name, arguments: args } = step.toolCall;
      return fauxAssistantMessage([fauxToolCall(name, args, { id })], { stopReason: "toolUse" });
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
