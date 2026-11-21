// The live half of Gate B criterion 4, exception (c) (card B3, plan decision
// 1): the same probes on a named model, recorded into a new cassette
// directory outside the committed fixtures, and replayed from it offline.
// Nothing here runs live until the pre-registration names the primary model
// and the lead supplies its key; no test reaches a provider (pi-ai's faux
// provider stands in for one).
//
//   make run CONFIG=research/configs/b3-gatemem-plane.json MODEL=<provider/model> LIVE=1
//   make run CONFIG=research/configs/b3-gatemem-plane.json MODEL=<provider/model> REPLAY=1
//
// The same guards and directories serve every benchmark the runner knows:
// GateMem, and MEM-INV-Bench since card X1 (plan decision 5).
//
// Guards, each refused before any session starts:
// - Recording refuses under ENGRAM_OFFLINE=1: offline means no model is
//   reached. `liveOptions` refuses it again, so a caller that skips
//   `liveConfig` still cannot record offline (review R5-3).
// - A scripted model refuses: a script is recorded by `make fixtures` only.
// - The cassette directory must be under the repository's `.engram/` (which
//   .gitignore keeps out of the repository) or outside the repository, and
//   never overlap `fixtures/` or the config's own cassettes (review R5-4). The
//   default is `.engram/runs/<config>-live/<provider>/<model>/cassettes`, or
//   `cassettes-upstream-<hash>` for a config that pins OpenRouter's upstream.
// - A replay (review R5-5) reads the same directory with every miss an error,
//   is allowed offline, and refuses a directory that does not exist.
// - A config's `openrouter_provider` (card RV6, model/upstream.ts) pins
//   OpenRouter's upstream for the answer model and the judge; a live run
//   refuses it for a model that is not on OpenRouter, and for one model
//   pinned two ways. Every live run records the upstream that served each
//   OpenRouter call, pinned or not.
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createModels } from "@earendil-works/pi-ai";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import { canonicalJson, sha256 } from "@engram/core";
import { fileCache, recordingRefusal } from "@engram/model";
import type { LiveModels } from "./answers.ts";
import { configJudge } from "./config.ts";
import { longMemEvalJudge } from "./longmemeval-probe.ts";
import {
  OPENROUTER,
  type OpenRouterProvider,
  type OpenRouterRouting,
  routedModels,
} from "./model/upstream.ts";
import type { RunnerOptions } from "./run.ts";

/** What a live run or a replay sets of any runner's options: the cassettes, offline, and the live models. */
export type LiveRunOptions = Pick<RunnerOptions, "cache" | "offline" | "live">;

/** What the live guards read of a config, whatever its benchmark (GateMem, MEM-INV-Bench). */
export interface LiveRunConfig {
  name: string;
  model: string;
  cassettes: string;
  /** What names the judge a live run calls (a GateMem or LongMemEval config's own, or its paper's). */
  kind?: string;
  benchmark?: string;
  judge?: { model: string } | undefined;
  /** OpenRouter's upstream for the answer model and the judge (card RV6). */
  openrouter_provider?: OpenRouterProvider | undefined;
}

export class LiveRunRefused extends Error {
  constructor(message: string) {
    super(`live run refused: ${message}`);
    this.name = "LiveRunRefused";
  }
}

export interface LiveRunRequest {
  /** `provider/model-id`, the model the probes run on. */
  model: string;
  /** The repository root: only its `.engram/` folder may be written. */
  repo: string;
  /** The cassette directory; default under `<repo>/.engram/runs/`. */
  cassettes?: string;
  env?: NodeJS.ProcessEnv;
}

const SAFE_PART = /^[A-Za-z0-9._-]+$/;

const offline = (env: NodeJS.ProcessEnv) => env.ENGRAM_OFFLINE === "1";

/**
 * The last part of the default live cassette directory: `cassettes`, or
 * with an `openrouter_provider` pin `cassettes-upstream-<12 hex>`, a hash of
 * the pin in canonical JSON (review P60-4). The pin stays out of every cache
 * key, so a pinned run gets a folder of its own instead: a fresh live run
 * under a new pin never replays answers another upstream gave. An explicit
 * `--cassettes` folder is the caller's to keep apart.
 */
export function cassetteFolder(config: Pick<LiveRunConfig, "openrouter_provider">): string {
  const pin = config.openrouter_provider;
  if (pin === undefined) return "cassettes";
  return `cassettes-upstream-${sha256(canonicalJson(pin)).slice(0, 12)}`;
}

/** The named model's live cassette directory, checked against the rules above. */
function liveCassettes(config: LiveRunConfig, request: LiveRunRequest): string {
  const [provider = "", ...rest] = request.model.split("/");
  const id = rest.join("/");
  if (!provider || !id) throw new LiveRunRefused(`model ${request.model} is not provider/model-id`);
  if (provider === "scripted") {
    throw new LiveRunRefused(
      "a scripted model's cassettes are recorded by make fixtures, not by a live run",
    );
  }
  const parts = [provider, ...id.split("/")];
  if (!parts.every((p) => SAFE_PART.test(p) && p !== "." && p !== "..")) {
    throw new LiveRunRefused(`model ${request.model} does not name a safe directory`);
  }
  const cassettes = resolve(
    request.cassettes ??
      join(
        request.repo,
        ".engram",
        "runs",
        `${config.name}-live`,
        ...parts,
        cassetteFolder(config),
      ),
  );
  // The guard the cassette proxy applies too (@engram/model, card B10 review B10-8).
  const refusal = recordingRefusal(cassettes, {
    repo: request.repo,
    committed: [config.cassettes],
  });
  if (refusal !== undefined) throw new LiveRunRefused(refusal);
  return cassettes;
}

/**
 * The config a live run records with: the request's model and its live
 * cassette directory. Throws LiveRunRefused on any guard.
 */
export function liveConfig<C extends LiveRunConfig>(config: C, request: LiveRunRequest): C {
  if (offline(request.env ?? process.env)) {
    throw new LiveRunRefused("ENGRAM_OFFLINE=1 is set, and a live run reaches a model");
  }
  return { ...config, model: request.model, cassettes: liveCassettes(config, request) };
}

/**
 * The config that replays a live run's cassettes: the same model and
 * directory, allowed offline; the directory must exist.
 */
export function replayConfig<C extends LiveRunConfig>(config: C, request: LiveRunRequest): C {
  const cassettes = liveCassettes(config, request);
  // A live run that died before its first call leaves an empty folder (liveOptions
  // creates it), so a folder with no cassette file counts as nothing recorded.
  if (!existsSync(cassettes) || !readdirSync(cassettes).some((f) => f.endsWith(".json"))) {
    throw new LiveRunRefused(`no recorded cassettes at ${cassettes} to replay`);
  }
  return { ...config, model: request.model, cassettes };
}

/** pi-ai's built-in providers, reading their keys from the environment as pi-ai does. */
export function builtinLiveModels(): LiveModels {
  const models = createModels();
  for (const provider of builtinProviders()) models.setProvider(provider);
  return models;
}

/** The judge model a live run of `config` calls, if any: its own, or its benchmark's paper judge for an experiment. */
function judgeModel(config: LiveRunConfig): string | undefined {
  if (config.judge) return config.judge.model;
  if (config.kind !== "experiment") return undefined;
  if (config.benchmark === "gatemem") return configJudge({ kind: "experiment" })?.model;
  if (config.benchmark === "longmemeval") return longMemEvalJudge({ kind: "experiment" })?.model;
  return undefined;
}

/**
 * The OpenRouter routing of each pinned model of `config` (card RV6):
 * `openrouter_provider.answer` for its model, `.judge` for its judge.
 * Refused for a model not on OpenRouter (pi-ai sends the routing to
 * OpenRouter only) and for one model pinned two ways.
 */
export function upstreamRoutes(config: LiveRunConfig): Map<string, OpenRouterRouting> {
  const routes = new Map<string, OpenRouterRouting>();
  const pinned = config.openrouter_provider;
  if (pinned === undefined) return routes;
  const roles: [string, string | undefined, OpenRouterRouting | undefined][] = [
    ["answer", config.model, pinned.answer],
    ["judge", judgeModel(config), pinned.judge],
  ];
  for (const [role, model, routing] of roles) {
    if (routing === undefined) continue;
    if (model === undefined) {
      throw new LiveRunRefused(
        `openrouter_provider.${role} pins an upstream, and ${config.name} calls no ${role} model`,
      );
    }
    if (model.split("/")[0] !== OPENROUTER) {
      throw new LiveRunRefused(
        `openrouter_provider.${role} pins an OpenRouter upstream, and the ${role} model ${model} is not on OpenRouter; pi-ai sends OpenRouter's provider field to OpenRouter only`,
      );
    }
    const prior = routes.get(model);
    if (prior !== undefined && canonicalJson(prior) !== canonicalJson(routing)) {
      throw new LiveRunRefused(
        `${model} is both the answer model and the judge, and openrouter_provider pins it two ways`,
      );
    }
    routes.set(model, routing);
  }
  return routes;
}

/**
 * The runner options of a live run: record misses from `live` into the
 * config's cassettes, each pinned model with its OpenRouter routing and
 * every OpenRouter reply's serving provider recorded (card RV6). Refuses
 * under ENGRAM_OFFLINE=1, a second defence after `liveConfig`.
 */
export function liveOptions(
  config: LiveRunConfig,
  live: LiveModels,
  env: NodeJS.ProcessEnv = process.env,
): LiveRunOptions {
  if (offline(env)) {
    throw new LiveRunRefused("ENGRAM_OFFLINE=1 is set, and a live run reaches a model");
  }
  return {
    cache: fileCache(config.cassettes),
    offline: false,
    live: routedModels(live, upstreamRoutes(config)),
  };
}

/** The runner options of a replay: the config's cassettes only, every miss an error. */
export function replayOptions(config: LiveRunConfig): LiveRunOptions {
  return { cache: fileCache(config.cassettes), offline: true };
}
