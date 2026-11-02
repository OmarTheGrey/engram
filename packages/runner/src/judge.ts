// GateMem's answer judge in the runner (PR #25 review, J1): each probe's
// answer is judged as GateMem's own scoring judges it (card B1's port,
// packages/bench gatemem/judge.ts: upstream's prompt, its three attempts,
// two of them with a JSON schema, and its verdict), and the per-condition
// summary is promoted as score_predictions.py --use_llm_judge promotes it.
// Every judge call is cached and keyed like an answer call (ADR 0017): the
// probe's item, condition, preset and store, the judge model, the row's seed
// and the prompt hash. Tests and fixtures use a scripted judge.
//
// The live judge is the paper's (`openai/gpt-4o`) through pi-ai. Upstream
// asks OpenAI's Responses API for structured output with
// `text.format = {type: json_schema, name, strict: true, schema}`; pi-ai's
// OpenAI Responses adapter merges `samplingParams` into the request body as
// it is, so the same payload goes out. A structured attempt on any other API
// is refused (UnsupportedRequestError), which stops the judge as the port
// does rather than change the protocol. The judge runs at temperature 0 and
// sends no seed (upstream sends none, and the Responses API takes none); the
// row's seed only keys its cache entry.
import { gatemem } from "@engram/bench";
import { type ModelCall, UnsupportedRequestError } from "@engram/core";
import type { LiveModels } from "./answers.ts";
import type { RunnerConfig } from "./config.ts";
import { type CacheStore, type CallContext, cached, type UsageRecord } from "./model/cached.ts";

/** The API whose request body carries upstream's structured-output payload through `samplingParams`. */
export const STRUCTURED_JUDGE_API = "openai-responses";

/** A live judge on pi-ai: upstream's structured-output payload on the OpenAI Responses API. */
export function liveJudgeCall(models: LiveModels): ModelCall {
  return async (request) => {
    const [provider = "", ...rest] = request.model.split("/");
    const model = models.getModel(provider, rest.join("/"));
    if (!model) throw new Error(`no live judge model ${request.model}`);
    const schema = request.responseSchema;
    if (schema !== undefined && model.api !== STRUCTURED_JUDGE_API) {
      throw new UnsupportedRequestError(request.model, "structured output", schema.name);
    }
    const reply = await models.completeSimple(
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
        ...(schema === undefined
          ? {}
          : {
              samplingParams: {
                text: {
                  format: {
                    type: "json_schema",
                    name: schema.name,
                    strict: true,
                    schema: schema.schema,
                  },
                },
              },
            }),
      },
    );
    if (reply.stopReason === "error" || reply.stopReason === "aborted") {
      throw new Error(`judge call failed: ${reply.errorMessage ?? reply.stopReason}`);
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
