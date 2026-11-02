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
import { gatemem } from "@engram/bench";
import { type ModelCall, UnsupportedRequestError } from "@engram/core";
import type { LiveModels } from "./answers.ts";
import type { RunnerConfig } from "./config.ts";
import { type CacheStore, type CallContext, cached, type UsageRecord } from "./model/cached.ts";
import { JUDGE_RETRY, realSleep, type Sleep, withRetry } from "./model/retry.ts";

/** The one API a live judge runs on: it carries the seed and `response_format` through `samplingParams`. */
export const SEEDED_JUDGE_API = "openai-completions";

/**
 * A live judge on pi-ai: seeded chat completions, with upstream's JSON schema
 * as `response_format`. A transient failure is retried as GateMem's router
 * retries it (JUDGE_RETRY: three attempts, 429, 5xx and network errors, waits
 * of min(2^i, 10) seconds); a call that still fails, or fails otherwise,
 * throws, and the port's judgeOne records the failed attempt and goes on to
 * its next one, as upstream's scoring does with the router's error (PR #25
 * review round 3, V-4). Nothing failed is cached. The reply is not stripped
 * here: the port's parser strips it as upstream's provider does, and a test
 * holds a padded verdict to the stripped one's row.
 */
export function liveJudgeCall(models: LiveModels, options: { sleep?: Sleep } = {}): ModelCall {
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
    );
    if (reply.stopReason === "error" || reply.stopReason === "aborted") {
      throw new Error(
        `judge call failed after ${attempts} ${attempts === 1 ? "attempt" : "attempts"}: ${reply.errorMessage ?? reply.stopReason}`,
      );
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
}

/** One probe's answer judged as GateMem judges it, every call through the cache. */
export async function judgeAnswer(spec: JudgeSpec): Promise<gatemem.JudgeRow> {
  const { judge } = spec;
  const inner: ModelCall = judge.model.startsWith("scripted/")
    ? gatemem.scriptedJudge(gatemem.readJudgeScript(judge.script as string))(
        spec.checkpoint.checkpoint_id,
      )
    : spec.live
      ? liveJudgeCall(spec.live)
      : async (request) => {
          throw new Error(`no live judge ${request.model} to answer a cache miss`);
        };
  const call = cached(inner, {
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
