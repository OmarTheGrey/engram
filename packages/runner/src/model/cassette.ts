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
// same transcript on another machine has the same cache key. Different
// transcripts never share a key (finding R7-6): every message, system ones
// included, keeps its place; braces already in the text are doubled before
// the working directory is replaced, and it is replaced only where it stands
// as a whole path; and every stream option that changes the answer is in
// the request.
//
// A live model on a miss receives the config's seed and the agent loop's
// sampling options (finding R7-7, AGENTS.md rule 6). pi-ai has no seed
// option; the seed goes in `samplingParams`, which only its OpenAI-compatible
// chat completions API sends, so a live model on any other API is refused
// rather than called unseeded.
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

/** What a miss is answered with besides the transcript: the config's seed and the loop's options. */
export interface AnswerCall {
  seed: number;
  stream?: SimpleStreamOptions;
}

/** Answers a transcript the cache does not hold. */
export type AnswerSource = (context: Context, call: AnswerCall) => Promise<AssistantMessage>;

/** pi-ai APIs that send `samplingParams.seed` to the provider. */
export const SEEDED_APIS: readonly string[] = ["openai-completions"];

/**
 * A real pi-ai model, reached through a model runtime or a Models collection,
 * with the call's seed and sampling options; refused when its API cannot
 * carry a seed.
 */
export function runtimeAnswers(models: CompletesSimple, model: Model<Api>): AnswerSource {
  return async (context, { seed, stream }) => {
    if (!SEEDED_APIS.includes(model.api)) {
      throw new Error(
        `live model ${model.provider}/${model.id} uses API ${model.api}, which takes no seed; a miss would record an unseeded call (AGENTS.md rule 6)`,
      );
    }
    return models.completeSimple(model, context, {
      ...stream,
      samplingParams: { ...stream?.samplingParams, seed },
    });
  };
}

/** A scripted model: one step per call, in order (one script per session). */
export function scriptedAnswers(
  steps: readonly ScriptStep[],
  options: { provider: string; model: string },
): AnswerSource {
  const scripted = scriptedPiModel(steps, options);
  const models = createModels();
  models.setProvider(scripted.provider);
  // A script needs no seed: its answers are fixed. The faux provider
  // estimates usage from the prompt length, which includes the temporary
  // working directory; a scripted answer costs nothing, so its cassette
  // records zero usage and is the same on every machine.
  return async (context) => ({
    ...(await models.completeSimple(scripted.model, context)),
    usage: NO_USAGE,
  });
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

const regexEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A character that continues a path: the directory is replaced only where none touches it. */
const PATH_CHAR = String.raw`[A-Za-z0-9._\-/\\:]`;
const NAME_CHAR = String.raw`[A-Za-z0-9._\-]`;
const doubleBraces = (s: string) => s.replaceAll("{", "{{").replaceAll("}", "}}");

/**
 * Every string with its braces doubled and the working directory, in either
 * slash form and standing as a whole path, replaced by `{cwd}`. Doubling
 * first makes the replacement reversible, so a literal `{cwd}` (now
 * `{{cwd}}`) never reads as the directory.
 */
function withoutCwd(value: unknown, cwd: string): Json {
  const forms = [...new Set([cwd, cwd.replaceAll("\\", "/")])].filter((f) => f.length > 0);
  const whole =
    forms.length === 0
      ? undefined
      : new RegExp(`(?<!${PATH_CHAR})(?:${forms.map(regexEscape).join("|")})(?!${NAME_CHAR})`);
  const walk = (v: unknown): Json => {
    if (typeof v === "string") {
      return whole ? v.split(whole).map(doubleBraces).join("{cwd}") : doubleBraces(v);
    }
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

/** Stream options besides temperature and maxTokens that change what the model answers. */
const ANSWER_OPTIONS = ["reasoning", "toolChoice", "samplingParams", "thinkingBudgets"] as const;

/**
 * The ModelRequest for one transcript. Every message, system messages (the
 * prompt, its section patches and the tool declarations) included, is one
 * entry of `messages` in its place, as canonical JSON of what reaches the
 * model; assistant turns are `assistant` and the rest `user`, since the JSON
 * carries the role. The temperature and token limit are the ones the agent
 * loop sent, if any; its other answer-changing options are one leading
 * `request-options` entry when any is set.
 */
export function transcriptRequest(
  transcript: { messages: readonly Message[] },
  options: TranscriptRequestOptions,
): ModelRequest {
  const stream: Record<string, unknown> = { ...options.stream };
  const extra = Object.fromEntries(
    ANSWER_OPTIONS.filter((k) => stream[k] !== undefined).map((k) => [k, stream[k]]),
  );
  const head =
    Object.keys(extra).length === 0
      ? []
      : [
          {
            role: "user" as const,
            content: canonicalJson(withoutCwd({ role: "request-options", ...extra }, options.cwd)),
          },
        ];
  const messages = [
    ...head,
    ...transcript.messages.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: canonicalJson(withoutCwd(sent(m), options.cwd)),
    })),
  ];
  const { temperature, maxTokens } = options.stream ?? {};
  return {
    model: options.model,
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
      const reply = await options.answers(
        { messages: transcript.messages },
        { seed: options.seed, ...(stream === undefined ? {} : { stream }) },
      );
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
