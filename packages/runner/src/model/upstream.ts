// OpenRouter's upstream provider, pinned and recorded (card RV6, design
// review RV-DES-11). OpenRouter serves one model id from several upstream
// providers, which may differ in quantisation, context limit and answers; a
// live run that lets OpenRouter route freely may be served by a mix.
//
// pi-ai 1.3.0 can pin it. Its chat completions adapter
// (api/openai-completions.js) copies a model's `compat.openRouterRouting`
// into the request body as OpenRouter's `provider` routing object, with
// `order`, `only`, `ignore`, `allow_fallbacks` and the rest of OpenRouter's
// fields (providers/compat-schema.d.ts, OpenRouterRoutingSchema). A config's
// `openrouter_provider` names that object for the answer model and for the
// judge, and `routedModels` sets it on the model pi-ai resolves, so every
// live call of that model carries it.
//
// pi-ai does not put the serving provider on its AssistantMessage, but it
// hands every parsed stream chunk to `onProviderStreamEvent` before it
// normalises it (StreamOptions in types.d.ts, called in
// openai-completions.js for each chunk), and OpenRouter's chunks carry the
// upstream that served them as `provider`. `routedModels` reads it there, and
// `servedBy(reply)` returns it; the answer path and the judge record it in
// the cassette (`upstream`, beside the response) and in the usage ledger.
//
// Neither the routing nor the serving provider is part of a cache key (rule
// 7's key is the item, condition, preset, store, model, seed and prompt
// hash): a cassette recorded before either existed replays unchanged. The
// routing is in the config, so in the run's fingerprint: a resume or a merge
// under another routing is refused.
import type { Api, AssistantMessage, Context, Model } from "@earendil-works/pi-ai";
import { z } from "zod";
import type { LiveModels } from "../answers.ts";

/**
 * OpenRouter's provider routing object, as far as a run pins an upstream
 * with it: `order` (tried in order), `only` (no other), `ignore`,
 * `allow_fallbacks` (false: none outside `order`), `require_parameters`
 * (only upstreams that honour every parameter sent, the seed among them),
 * `quantizations` and `data_collection`. The field names are OpenRouter's.
 */
export const OpenRouterRouting = z
  .strictObject({
    order: z.array(z.string().min(1)).min(1).optional(),
    only: z.array(z.string().min(1)).min(1).optional(),
    ignore: z.array(z.string().min(1)).min(1).optional(),
    allow_fallbacks: z.boolean().optional(),
    require_parameters: z.boolean().optional(),
    quantizations: z.array(z.string().min(1)).min(1).optional(),
    data_collection: z.enum(["allow", "deny"]).optional(),
  })
  .refine(
    (r) => r.order !== undefined || r.only !== undefined,
    "a pinned upstream names it in order or only",
  );
export type OpenRouterRouting = z.infer<typeof OpenRouterRouting>;

/**
 * A config's `openrouter_provider`: the routing of the answer model and of
 * the judge. `answer_model` (card R6) names the `provider/model-id` the
 * answer routing was chosen for: an experiment config's model is a slot
 * (`prereg/M1`) the command line fills, so without it a live run on another
 * `MODEL=` would send M1's routing to that model. A live run refuses a model
 * other than the one named; absent, any model runs as before. It is the
 * config's, never sent to OpenRouter: the routing pi-ai receives is `answer`.
 */
export const OpenRouterProvider = z
  .strictObject({
    answer: OpenRouterRouting.optional(),
    answer_model: z
      .string()
      .regex(/^[^/\s]+\/\S+$/, "answer_model must be provider/model-id")
      .optional(),
    judge: OpenRouterRouting.optional(),
  })
  .refine(
    (p) => p.answer_model === undefined || p.answer !== undefined,
    "answer_model names the model an answer pin was chosen for, and there is no answer pin",
  );
export type OpenRouterProvider = z.infer<typeof OpenRouterProvider>;

export const OPENROUTER = "openrouter";

const served = new WeakMap<AssistantMessage, string>();

/** The upstream provider that served `reply`, when OpenRouter reported one. */
export const servedBy = (reply: AssistantMessage): string | undefined => served.get(reply);

/** The `provider` field of an OpenRouter stream chunk, when it has one. */
function chunkProvider(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const provider = (data as { provider?: unknown }).provider;
  return typeof provider === "string" && provider.length > 0 ? provider : undefined;
}

/**
 * `live` with each routed model (`provider/model-id` to routing) resolved
 * with that routing as its `compat.openRouterRouting`, and every OpenRouter
 * reply's serving provider kept for `servedBy`.
 */
export function routedModels(
  live: LiveModels,
  routes: ReadonlyMap<string, OpenRouterRouting> = new Map(),
): LiveModels {
  return {
    getModel(provider, id) {
      const model = live.getModel(provider, id);
      const routing = routes.get(`${provider}/${id}`);
      if (!model || routing === undefined) return model;
      return {
        ...model,
        compat: { ...(model.compat ?? {}), openRouterRouting: routing },
      } as Model<Api>;
    },
    async completeSimple(model: Model<Api>, context: Context, options?: object) {
      if (model.provider !== OPENROUTER) return live.completeSimple(model, context, options);
      let upstream: string | undefined;
      const prior = (options as { onProviderStreamEvent?: (d: unknown, m: unknown) => unknown })
        ?.onProviderStreamEvent;
      const reply = await live.completeSimple(model, context, {
        ...options,
        onProviderStreamEvent: async (data: unknown, m: unknown) => {
          upstream ??= chunkProvider(data);
          await prior?.(data, m);
        },
      });
      if (upstream !== undefined) served.set(reply, upstream);
      return reply;
    },
  };
}
