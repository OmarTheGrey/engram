// GateMem's answer judge in the runner (PR #25 review, J1): each probe's
// answer is judged as GateMem's own scoring judges it (card B1's port,
// packages/bench gatemem/judge.ts: upstream's prompt, its three attempts,
// two of them with a JSON schema, and its verdict), and the per-condition
// summary is promoted as score_predictions.py --use_llm_judge promotes it.
// Every judge call is cached and keyed like an answer call (ADR 0017): the
// probe's item, condition, preset and store, the judge model, the row's seed
// and the prompt hash. Tests and fixtures use a scripted judge.
//
// The live judge is the paper's model, OpenAI's GPT-4o, reached through
// OpenRouter's chat completions (`openrouter/openai/gpt-4o`), the
// OpenAI-compatible API that carries a seed, so every judge call is seeded as
// ADR 0017 (finding R7-7) requires of any live call (PR #25 review round 2,
// R4); upstream reaches it through OpenAI's Responses API, which takes no
// seed. The structured attempts send upstream's JSON schema as chat
// completions' `response_format` ({type: json_schema, json_schema: {name,
// strict: true, schema}}); pi-ai's chat-completions adapter merges
// `samplingParams` into the request body as it is, the seed with it. A judge
// on any other API is refused before it is called (UnsupportedRequestError),
// which stops the judge as the port does rather than send an unseeded call or
// drop the schema.

import type { AssistantMessage } from "@earendil-works/pi-ai";
import { gatemem } from "@engram/bench";
import {
  type ModelCall,
  type ModelRequest,
  type ModelUsage,
  UnsupportedRequestError,
} from "@engram/core";
import {
  type CachedOptions,
  type CacheStore,
  type CallContext,
  cached,
  cacheKey,
  type ServedResponse,
  TransientCallError,
  type UsageRecord,
} from "@engram/model";
import type { LiveModels } from "./answers.ts";
import type { RunnerConfig } from "./config.ts";
import {
  attemptUsage,
  isTransient,
  JUDGE_RETRY,
  realSleep,
  type Sleep,
  withRetry,
} from "./model/retry.ts";
import { servedBy } from "./model/upstream.ts";

/** The one API a live judge runs on: it carries the seed and `response_format` through `samplingParams`. */
export const SEEDED_JUDGE_API = "openai-completions";

/**
 * A live judge on pi-ai: seeded chat completions, with upstream's JSON schema
 * as `response_format`. A transient failure is retried as GateMem's router
 * retries it (JUDGE_RETRY: three attempts, 429, 5xx and network errors, waits
 * of min(2^i, 10) seconds); a call that still fails, or fails otherwise,
 * throws, and the port's judgeOne records the failed attempt and goes on to
 * its next one, as upstream's scoring does with the router's error (PR #25
 * review round 3, V-4). A failure that is not transient (a 400, a 401) is a
 * JudgeCallFailed, which GateMem's judge records as a cassette entry
 * (cachedJudgeCall, card RV1, RV-EXP-3), so a replay fails the same attempt
 * the same way. A transient failure that outlasted the retry is a
 * TransientCallError, never recorded: it stops the run, and a resume makes
 * the call again (review RV1-1). Each failed attempt's usage goes to
 * `onFailedAttempt`, so the ledger holds what was paid (review RV1-3). The
 * reply is not stripped
 * here: the port's parser strips it as upstream's provider does, and a test
 * holds a padded verdict to the stripped one's row.
 */
export function liveJudgeCall(
  models: LiveModels,
  options: {
    sleep?: Sleep | undefined;
    onFailedAttempt?: ((request: ModelRequest, reply: AssistantMessage) => void) | undefined;
  } = {},
): ModelCall {
  return async (request) => {
    const [provider = "", ...rest] = request.model.split("/");
    const model = models.getModel(provider, rest.join("/"));
    if (!model) throw new Error(`no live judge model ${request.model}`);
    const schema = request.responseSchema;
    if (model.api !== SEEDED_JUDGE_API) {
      throw new UnsupportedRequestError(
        request.model,
        "a seeded call (ADR 0017, finding R7-7)",
        `API ${model.api} takes no seed`,
      );
    }
    const { reply, attempts } = await withRetry(
      () =>
        models.completeSimple(
          model,
          {
            // The lint calls (card L3) carry a system prompt; GateMem's judge
            // sends none, so its requests are unchanged.
            ...(request.system === undefined ? {} : { systemPrompt: request.system }),
            messages: request.messages.map((m) => ({
              role: "user" as const,
              content: m.content,
              timestamp: 0,
            })),
          },
          {
            ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
            ...(request.maxTokens === undefined ? {} : { maxTokens: request.maxTokens }),
            samplingParams: {
              seed: request.seed,
              ...(schema === undefined
                ? {}
                : {
                    response_format: {
                      type: "json_schema",
                      json_schema: { name: schema.name, strict: true, schema: schema.schema },
                    },
                  }),
            },
          },
        ),
      JUDGE_RETRY,
      options.sleep ?? realSleep,
      (failed) => options.onFailedAttempt?.(request, failed),
    );
    if (reply.stopReason === "error" || reply.stopReason === "aborted") {
      const message = `judge call failed after ${attempts} ${attempts === 1 ? "attempt" : "attempts"}: ${reply.errorMessage ?? reply.stopReason}`;
      // An aborted call was not answered, and a transient failure may pass:
      // neither is recorded, and the run stops (review RV1-1).
      if (reply.stopReason === "aborted") {
        options.onFailedAttempt?.(request, reply);
        throw new Error(message);
      }
      if (isTransient(reply.errorMessage, JUDGE_RETRY)) {
        options.onFailedAttempt?.(request, reply);
        throw new TransientCallError(message);
      }
      throw new JudgeCallFailed(message, {
        input_tokens: reply.usage.input,
        output_tokens: reply.usage.output,
        cost_usd: reply.usage.cost.total,
      });
    }
    const upstream = servedBy(reply);
    const response: ServedResponse = {
      text: reply.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join(""),
      usage: {
        input_tokens: reply.usage.input,
        output_tokens: reply.usage.output,
        cost_usd: reply.usage.cost.total,
      },
      // The upstream OpenRouter served it from (card RV6), kept in the cassette.
      ...(upstream === undefined ? {} : { upstream }),
    };
    return response;
  };
}

/**
 * A live judge or lint call the provider answered with a failure, after the
 * retry (RV-EXP-3): a reply as much as a verdict is, recorded and replayed.
 */
export class JudgeCallFailed extends Error {
  readonly usage: ModelUsage;

  constructor(message: string, usage: ModelUsage) {
    super(message);
    this.name = "JudgeCallFailed";
    this.usage = usage;
  }
}

/** What a cassette holds for a failed call: this mark, then the failure's message. */
export const FAILED_CALL_MARK = "\u0000engram/failed-call\u0000";

/**
 * A judge or lint call that is not recorded when it fails (LongMemEval's
 * judge, the lints: review RV1-1): a JudgeCallFailed from `inner` was paid
 * for, so its usage goes to `onUsage` under the call's key, and it is thrown
 * on, stopping the run as before.
 */
export function paidFailures(
  inner: ModelCall,
  options: { context: CallContext; onUsage?: ((usage: UsageRecord) => void) | undefined },
): ModelCall {
  return async (request) => {
    try {
      return await inner(request);
    } catch (e) {
      if (e instanceof JudgeCallFailed) {
        options.onUsage?.({
          key: cacheKey(options.context, request),
          model: request.model,
          hit: false,
          ...e.usage,
        });
      }
      throw e;
    }
  };
}

/** The ledger record of a failed live attempt, under the call's cache key (review RV1-3). */
export const failedAttempt =
  (context: CallContext, onUsage: ((usage: UsageRecord) => void) | undefined) =>
  (request: ModelRequest, reply: AssistantMessage) =>
    onUsage?.(attemptUsage(cacheKey(context, request), request.model, reply));

/**
 * GateMem's judge call through the cache (ADR 0017), which records a call
 * that failed for good as well as an answered one (card RV1, RV-EXP-3), since
 * GateMem's judgeOne goes on to its next attempt: a JudgeCallFailed
 * from `inner` is stored as a cassette entry holding FAILED_CALL_MARK and
 * its message, and whenever that entry is read, recorded or replayed, the
 * same JudgeCallFailed is thrown. A replay therefore fails the same attempt
 * the live run failed, GateMem's judgeOne goes on to its next attempt in
 * both, and a live rerun never pays for the call again. Any other error
 * (an offline miss, a refused request, an aborted call) is not recorded.
 */
export function cachedJudgeCall(inner: ModelCall, options: CachedOptions): ModelCall {
  const recording: ModelCall = async (request) => {
    try {
      return await inner(request);
    } catch (e) {
      if (e instanceof JudgeCallFailed) {
        return { text: `${FAILED_CALL_MARK}${e.message}`, usage: e.usage };
      }
      throw e;
    }
  };
  const call = cached(recording, options);
  return async (request) => {
    const response = await call(request);
    if (response.text.startsWith(FAILED_CALL_MARK)) {
      throw new JudgeCallFailed(response.text.slice(FAILED_CALL_MARK.length), response.usage);
    }
    return response;
  };
}

export interface JudgeSpec {
  judge: NonNullable<RunnerConfig["judge"]>;
  checkpoint: gatemem.Checkpoint;
  output: Record<string, unknown>;
  seed: number;
  context: CallContext;
  cache: CacheStore;
  live?: LiveModels | undefined;
  offline?: boolean | undefined;
  onUsage?: ((usage: UsageRecord) => void) | undefined;
  /** How the live judge's retry waits; a real wait unless a test injects one. */
  sleep?: Sleep | undefined;
}

/** One probe's answer judged as GateMem judges it, every call through the cache. */
export async function judgeAnswer(spec: JudgeSpec): Promise<gatemem.JudgeRow> {
  const { judge } = spec;
  const inner: ModelCall = judge.model.startsWith("scripted/")
    ? gatemem.scriptedJudge(gatemem.readJudgeScript(judge.script as string))(
        spec.checkpoint.checkpoint_id,
      )
    : spec.live
      ? liveJudgeCall(spec.live, {
          sleep: spec.sleep,
          onFailedAttempt: failedAttempt(spec.context, spec.onUsage),
        })
      : async (request) => {
          throw new Error(`no live judge ${request.model} to answer a cache miss`);
        };
  const call = cachedJudgeCall(inner, {
    cache: spec.cache,
    context: spec.context,
    ...(spec.offline === undefined ? {} : { offline: spec.offline }),
    ...(spec.onUsage === undefined ? {} : { onUsage: spec.onUsage }),
  });
  return gatemem.judgeOne(
    call,
    spec.checkpoint,
    spec.output,
    {
      model: judge.model,
      seed: spec.seed,
      temperature: judge.temperature,
      maxTokens: judge.max_tokens,
    },
    false,
  );
}
