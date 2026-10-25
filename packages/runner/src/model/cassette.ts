// How a pi session's model calls are cached (ADR 0017, card RN1). The
// session's model is a pi-ai faux provider that never answers by itself: on
// each call it turns the full transcript the agent loop sent (system prompt,
// tool declarations, every message) into a ModelRequest, and answers through
// `cached()`. A hit replays the recorded assistant message; a miss goes to the
// answer source (a scripted model when recording offline, or a real pi-ai
// model through a model runtime) and is recorded. With ENGRAM_OFFLINE=1 a miss
// is an OfflineMissError, which the run rethrows after the prompt ends.
//
// The request is the transcript with what does not reach the model's answer
// removed (timestamps, usage, durations, response ids, tool result details)
// and the session's temporary working directory replaced by `{cwd}`, so the
// same transcript on another machine has the same cache key.
import {
  type Api,
  type AssistantMessage,
  type Context,
  createModels,
  type FauxContentBlock,
  type FauxResponseFactory,
  fauxAssistantMessage,
  fauxProvider,
  type Message,
  type Model,
  type SimpleStreamOptions,
  type TranscriptContext,
} from "@earendil-works/pi-ai";
import { canonicalJson, type ModelCall, type ModelRequest, type ModelResponse } from "@engram/core";
import { type CacheStore, type CallContext, cached, type UsageRecord } from "./cached.ts";
import type { CompletesSimple } from "./pi.ts";
import { type ScriptStep, scriptedPiModel } from "./scripted.ts";

/** Answers a transcript the cache does not hold. */
export type AnswerSource = (context: Context) => Promise<AssistantMessage>;

/** A real pi-ai model, reached through a model runtime or a Models collection. */
export function runtimeAnswers(models: CompletesSimple, model: Model<Api>): AnswerSource {
  return (context) => models.completeSimple(model, context);
}

/** A scripted model: one step per call, in order (one script per session). */
export function scriptedAnswers(
  steps: readonly ScriptStep[],
  options: { provider: string; model: string },
): AnswerSource {
  const scripted = scriptedPiModel(steps, options);
  const models = createModels();
  models.setProvider(scripted.provider);
  const answer = runtimeAnswers(models, scripted.model);
  // The faux provider estimates usage from the prompt length, which includes
  // the temporary working directory; a scripted answer costs nothing, so its
  // cassette records zero usage and is the same on every machine.
  return async (context) => ({ ...(await answer(context)), usage: NO_USAGE });
}

const NO_USAGE: AssistantMessage["usage"] = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Every string with the working directory, in either slash form, replaced by `{cwd}`. */
function withoutCwd(value: unknown, cwd: string): Json {
  const forms = [cwd, cwd.replaceAll("\\", "/")].filter((f) => f.length > 0);
  const walk = (v: unknown): Json => {
    if (typeof v === "string") return forms.reduce((s, f) => s.split(f).join("{cwd}"), v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v)
          .filter(([, x]) => x !== undefined)
          .map(([k, x]) => [k, walk(x)]),
      );
    }
    return v as Json;
  };
  return walk(value);
}

/** The parts of one transcript message that reach the model. */
function sent(message: Message): Record<string, unknown> {
  switch (message.role) {
    case "system":
      return {
        role: "system",
        content: message.content,
        sections: message.sections,
        toolsAdded: message.toolsAdded,
        toolsRemoved: message.toolsRemoved,
      };
    case "user":
      return { role: "user", content: message.content };
    case "assistant":
      return { role: "assistant", content: message.content };
    case "toolResult":
      return {
        role: "toolResult",
        toolCallId: message.toolCallId,
        toolName: message.toolName,
        content: message.content,
        isError: message.isError,
      };
  }
}

export interface TranscriptRequestOptions {
  /** `provider/model-id`. */
  model: string;
  seed: number;
  /** The session's working directory, replaced by `{cwd}`. */
  cwd: string;
  stream?: SimpleStreamOptions;
}

/**
 * The ModelRequest for one transcript. System messages (the prompt and the
 * tool declarations) become `system`; every other message is one entry of
 * `messages`, as canonical JSON, with tool results sent as the user turn they
 * are to the model. The temperature and token limit are the ones the agent
 * loop sent, if any.
 */
export function transcriptRequest(
  transcript: { messages: readonly Message[] },
  options: TranscriptRequestOptions,
): ModelRequest {
  const parts = transcript.messages.map((m) => withoutCwd(sent(m), options.cwd));
  const system = parts.filter((_, i) => transcript.messages[i]?.role === "system");
  const messages = transcript.messages.flatMap((m, i) =>
    m.role === "system"
      ? []
      : [
          {
            role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: canonicalJson(parts[i]),
          },
        ],
  );
  const { temperature, maxTokens } = options.stream ?? {};
  return {
    model: options.model,
    ...(system.length > 0 ? { system: canonicalJson(system) } : {}),
    messages,
    seed: options.seed,
    ...(temperature === undefined ? {} : { temperature }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
  };
}

/** What a cassette records of an assistant message: its content and why it stopped. */
interface Recorded {
  content: FauxContentBlock[];
  stopReason: AssistantMessage["stopReason"];
}

const encode = (reply: AssistantMessage): string =>
  canonicalJson({ content: reply.content, stopReason: reply.stopReason } satisfies Recorded);

function decode(response: ModelResponse): AssistantMessage {
  const recorded = JSON.parse(response.text) as Recorded;
  return fauxAssistantMessage(recorded.content, { stopReason: recorded.stopReason, timestamp: 0 });
}

export interface CassetteModelOptions {
  /** `provider/model-id`; the session sees this provider and model id. */
  model: string;
  seed: number;
  cwd: string;
  cache: CacheStore;
  context: CallContext;
  answers: AnswerSource;
  /** Refuse misses; unset means ENGRAM_OFFLINE=1 decides (see `cached`). */
  offline?: boolean;
  onUsage?: (usage: UsageRecord) => void;
}

/**
 * A pi-ai provider and model for a session, answering every call through the
 * cache. `errors` holds what made a call fail (an offline miss, an exhausted
 * script), since the agent loop turns a provider error into an assistant
 * message rather than a rejection.
 */
export function cassettePiModel(options: CassetteModelOptions) {
  const [provider, ...rest] = options.model.split("/");
  const id = rest.join("/");
  const faux = fauxProvider({
    api: "engram-cassette",
    provider: provider as string,
    models: [{ id, reasoning: false }],
  });
  const errors: unknown[] = [];
  const respond: FauxResponseFactory = async (transcript: TranscriptContext, stream) => {
    // The faux provider consumes one queued step per call; queue the next.
    faux.appendResponses([respond]);
    const request = transcriptRequest(transcript, {
      model: options.model,
      seed: options.seed,
      cwd: options.cwd,
      ...(stream === undefined ? {} : { stream }),
    });
    const inner: ModelCall = async () => {
      const reply = await options.answers({ messages: transcript.messages });
      if (reply.stopReason === "error" || reply.stopReason === "aborted") {
        throw new Error(`model call failed: ${reply.errorMessage ?? reply.stopReason}`);
      }
      return {
        text: encode(reply),
        usage: {
          input_tokens: reply.usage.input,
          output_tokens: reply.usage.output,
          cost_usd: reply.usage.cost.total,
        },
      };
    };
    try {
      const call = cached(inner, {
        cache: options.cache,
        context: options.context,
        ...(options.offline === undefined ? {} : { offline: options.offline }),
        ...(options.onUsage === undefined ? {} : { onUsage: options.onUsage }),
      });
      return decode(await call(request));
    } catch (e) {
      errors.push(e);
      throw e;
    }
  };
  faux.setResponses([respond]);
  return { provider: faux.provider, model: faux.getModel(), errors };
}
