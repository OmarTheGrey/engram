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
  isContextOverflow,
  type Message,
  type Model,
  type SimpleStreamOptions,
  type TranscriptContext,
} from "@earendil-works/pi-ai";
import { canonicalJson, type ModelCall, type ModelRequest, type ModelResponse } from "@engram/core";
import {
  type CacheStore,
  type CallContext,
  cached,
  cacheKey,
  OfflineMissError,
  type ScriptStep,
  type ServedResponse,
  scriptedPiModel,
  TransientCallError,
  type UsageRecord,
} from "@engram/model";
import type { CompletesSimple } from "./pi.ts";
import {
  attemptUsage,
  httpStatus,
  isModerationFlag,
  isTransient,
  ProviderStopError,
  type RetryPolicy,
  realSleep,
  type Sleep,
  stoppingStatus,
  withRetry,
} from "./retry.ts";
import { servedBy } from "./upstream.ts";

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
  /**
   * How a miss whose answer failed for a transient reason is retried (card
   * RV1, RV-EXP-1): the benchmark's own client's policy. Only the final reply
   * is recorded, so the retry never moves a cache key. No retry when unset.
   */
  retry?: RetryPolicy;
  /** How the retry waits; a real wait unless a test injects one. */
  sleep?: Sleep;
  /**
   * The most model calls the session may make (card RV1, RV-EXP-5): the
   * call after the last one is never made, nothing is recorded for it, and
   * `capped` is set. Hits count as calls, so a replay caps where the run
   * did. Not part of any cache key: no call's request depends on it.
   */
  turnLimit?: number;
}

/**
 * Why a probe leaves a session out of its summaries: `turn limit`, a session
 * that asked for a call past the config's turn_limit (RV-EXP-5); `answer
 * refused`, a session whose answer call the provider refused with an error
 * no retry can fix, a prompt over the model's context limit (card X20,
 * lead-decisions item 14).
 */
export type Exclusion = "turn limit" | "answer refused";

/**
 * The provider refused an answer call with an error no retry can fix (card
 * X20): recorded in the cassette, so a replay refuses the same call, and the
 * probe excludes the session under `answer refused`.
 */
export class AnswerRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnswerRefused";
  }
}

export { ProviderStopError } from "./retry.ts";

/** What a cassette holds for a refused answer call: this mark, then the failure's message. */
export const REFUSED_ANSWER_MARK = "\u0000engram/refused-answer\u0000";

/** The statuses a context overflow comes with, when pi-ai's message carries one. */
const REFUSAL_STATUSES: readonly number[] = [400, 413];
/** Words of a key or credit problem: a message with any of them is never trusted as a refusal. */
const ACCOUNT_WORDS =
  /credit|afford|billing|payment|quota|api[ _-]?key|unauthori[sz]ed|forbidden|permission|auth(?:entication)? credentials/i;

/** How a failed answer call is handled (card X20): see `answerFailure`. */
export type AnswerFailure =
  | { kind: "halt"; status: number }
  | { kind: "transient" }
  | { kind: "refused" }
  | { kind: "stop" };

/**
 * How a failed answer reply is handled, read from pi-ai's `errorMessage`
 * with retry.ts's one status parse, since pi-ai reports a provider's HTTP
 * error as text (card X20). In order, so that a doubt always stops the run
 * and never excludes a session:
 *
 * 1. `halt`: `stoppingStatus` reads 401, 402, 404, or a 403 that is not
 *    OpenRouter's moderation flag, from the leading status or a `"code"` in
 *    the body. The run stops (ProviderStopError).
 * 2. `transient`: the retry policy's statuses and network errors (card RV1).
 *    The session stops unrecorded, as before.
 * 3. `refused`: OpenRouter's moderation flag (a 403 with its documented
 *    metadata); or pi-ai's own context-overflow patterns match
 *    (`isContextOverflow`), the leading status, if any, is 400 or 413, and
 *    the message names no key or credit. Recorded; the session is excluded.
 * 4. `stop`: anything else (a plain 400, an error with no status, an
 *    aborted call). The run stops, as before.
 */
export function answerFailure(
  reply: AssistantMessage,
  retry: RetryPolicy | undefined,
): AnswerFailure {
  if (reply.stopReason !== "error") return { kind: "stop" };
  const message = (reply.errorMessage ?? "").trim();
  const status = stoppingStatus(message);
  if (status !== undefined) return { kind: "halt", status };
  if (retry && isTransient(message, retry)) return { kind: "transient" };
  if (isModerationFlag(message)) return { kind: "refused" };
  const leading = httpStatus(message);
  if (
    isContextOverflow(reply) &&
    (leading === undefined || REFUSAL_STATUSES.includes(leading)) &&
    !ACCOUNT_WORDS.test(message)
  ) {
    return { kind: "refused" };
  }
  return { kind: "stop" };
}

/**
 * The backstop (review X20-2): this many `answer refused` exclusions in a
 * row in one process stop the run, so a key or endpoint failure the
 * classifier misread cannot exclude the whole run.
 */
export const REFUSAL_STREAK_LIMIT = 5;

/** Five refused sessions in a row: the run stops (see REFUSAL_STREAK_LIMIT). */
export class RefusalStreak extends Error {
  constructor(limit: number) {
    super(
      `${limit} sessions in a row ended in a refused answer call; the run stops with this one unrecorded, since a key, credit or endpoint failure may be misread as a refusal: check the provider, then rerun with RESUME=1 (the ${limit - 1} sessions before it are kept, excluded as answer refused)`,
    );
    this.name = "RefusalStreak";
  }
}

/** The refused sessions in a row this process has seen. */
const streak = { refused: 0 };

/** Start the backstop's count afresh (tests, which run many runs in one process). */
export function resetRefusalStreak(): void {
  streak.refused = 0;
}

/** The session asked for a call past its turn limit (RV-EXP-5); the call is not made. */
export class TurnLimitReached extends Error {
  constructor(limit: number) {
    super(`turn limit reached: the session made its ${limit} model calls`);
    this.name = "TurnLimitReached";
  }
}

/**
 * A pi-ai provider and model for a session, answering every call through the
 * cache. `errors` holds what made a call fail (an offline miss, an exhausted
 * script, a transient failure that outlasted the retry, a refused answer, a
 * key or credit error), since the agent loop
 * turns a provider error into an assistant message rather than a rejection.
 * `capped` is set when the session asked for a call past its turn limit.
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
  const state = { capped: false, calls: 0 };
  const respond: FauxResponseFactory = async (transcript: TranscriptContext, stream) => {
    // The faux provider consumes one queued step per call; queue the next.
    faux.appendResponses([respond]);
    if (options.turnLimit !== undefined && state.calls >= options.turnLimit) {
      state.capped = true;
      throw new TurnLimitReached(options.turnLimit);
    }
    state.calls++;
    const request = transcriptRequest(transcript, {
      model: options.model,
      seed: options.seed,
      cwd: options.cwd,
      ...(stream === undefined ? {} : { stream }),
    });
    const inner: ModelCall = async () => {
      const once = () =>
        options.answers(
          { messages: transcript.messages },
          { seed: options.seed, ...(stream === undefined ? {} : { stream }) },
        );
      // Every failed attempt was paid for: its usage goes to the ledger,
      // though no cassette holds it (card RV1, review RV1-3).
      const paid = (failed: AssistantMessage) =>
        options.onUsage?.(attemptUsage(cacheKey(options.context, request), options.model, failed));
      const { reply, attempts } = options.retry
        ? await withRetry(once, options.retry, options.sleep ?? realSleep, paid)
        : { reply: await once(), attempts: 1 };
      if (reply.stopReason === "error" || reply.stopReason === "aborted") {
        const message = `model call failed${attempts > 1 ? ` after ${attempts} attempts` : ""}: ${reply.errorMessage ?? reply.stopReason}`;
        const failure = answerFailure(reply, options.retry);
        // A refusal no retry can fix is a reply as much as an answer is
        // (card X20): recorded, its usage reaching the ledger through
        // `cached` as an answer's does, and replayed as the same refusal.
        if (failure.kind === "refused") {
          return {
            text: `${REFUSED_ANSWER_MARK}${message}`,
            usage: {
              input_tokens: reply.usage.input,
              output_tokens: reply.usage.output,
              cost_usd: reply.usage.cost.total,
            },
          } satisfies ServedResponse;
        }
        paid(reply);
        // A key, credit or endpoint problem stops the run unrecorded (card X20).
        if (failure.kind === "halt") throw new ProviderStopError(failure.status, message);
        // A transient failure that outlasted the retry stops the session
        // unrecorded; an outer retry or a resume makes the call again.
        if (failure.kind === "transient") throw new TransientCallError(message);
        throw new Error(message);
      }
      const upstream = servedBy(reply);
      const response: ServedResponse = {
        text: encode(reply),
        usage: {
          input_tokens: reply.usage.input,
          output_tokens: reply.usage.output,
          cost_usd: reply.usage.cost.total,
        },
        ...(upstream === undefined ? {} : { upstream }),
      };
      return response;
    };
    try {
      const call = cached(inner, {
        cache: options.cache,
        context: options.context,
        ...(options.offline === undefined ? {} : { offline: options.offline }),
        ...(options.onUsage === undefined ? {} : { onUsage: options.onUsage }),
      });
      const response = await call(request);
      if (response.text.startsWith(REFUSED_ANSWER_MARK)) {
        throw new AnswerRefused(response.text.slice(REFUSED_ANSWER_MARK.length));
      }
      return decode(response);
    } catch (e) {
      errors.push(e);
      throw e;
    }
  };
  faux.setResponses([respond]);
  return {
    provider: faux.provider,
    model: faux.getModel(),
    errors,
    get capped() {
      return state.capped;
    },
  };
}

/**
 * What ended a session in failure, judged on its final assistant message
 * (card RV1, RV-EXP-1): an error the session recovered from (a later call
 * succeeded and the session went on to its answer) is not a failure, and a
 * turn limit is not one either (the probe excludes that session). An offline
 * miss always is: a replay that missed a call did not replay the run.
 */
export function sessionFailure(
  messages: readonly { role: string; stopReason?: string; errorMessage?: string }[],
  cassette: { errors: readonly unknown[]; capped: boolean },
): unknown {
  const miss = cassette.errors.find((e) => e instanceof OfflineMissError);
  if (miss !== undefined) return miss;
  if (cassette.capped) return undefined;
  const final = [...messages].reverse().find((m) => m.role === "assistant");
  if (final?.stopReason !== "error" && final?.stopReason !== "aborted") return undefined;
  return (
    cassette.errors.at(-1) ??
    new Error(`model call failed: ${final.errorMessage ?? final.stopReason}`)
  );
}

/**
 * How a probe's session ended (card X20): `excluded` when the turn limit
 * capped it or the provider refused the answer call that ended it, `failure`
 * when `sessionFailure` reads it as one, neither when it answered. Only the
 * probes read a refusal as an exclusion; `sessionFailure` alone, as D3's
 * replay validation calls it, still reads it as a failure. It keeps the
 * backstop's count: the REFUSAL_STREAK_LIMIT-th refusal in a row is a
 * RefusalStreak failure, and a session that answered or was capped starts
 * the count afresh.
 */
export function sessionEnd(
  messages: readonly { role: string; stopReason?: string; errorMessage?: string }[],
  cassette: { errors: readonly unknown[]; capped: boolean },
): { failure?: unknown; excluded?: Exclusion } {
  const failure = sessionFailure(messages, cassette);
  if (failure instanceof AnswerRefused) {
    streak.refused++;
    if (streak.refused >= REFUSAL_STREAK_LIMIT) {
      streak.refused = 0;
      return { failure: new RefusalStreak(REFUSAL_STREAK_LIMIT) };
    }
    return { excluded: "answer refused" };
  }
  if (failure !== undefined) return { failure };
  streak.refused = 0;
  return cassette.capped ? { excluded: "turn limit" } : {};
}
