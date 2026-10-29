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
// Guards, each refused before any session starts:
// - Recording refuses under ENGRAM_OFFLINE=1: offline means no model is
//   reached. `liveOptions` refuses it again, so a caller that skips
//   `liveConfig` still cannot record offline (review R5-3).
// - A scripted model refuses: a script is recorded by `make fixtures` only.
// - The cassette directory must be under the repository's `.engram/` (which
//   .gitignore keeps out of the repository) or outside the repository, and
//   never overlap `fixtures/` or the config's own cassettes (review R5-4). The
//   default is `.engram/runs/<config>-live/<provider>/<model>/cassettes`.
// - A replay (review R5-5) reads the same directory with every miss an error,
//   is allowed offline, and refuses a directory that does not exist.
import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { createModels } from "@earendil-works/pi-ai";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import type { RunnerConfig } from "./config.ts";
import { fileCache } from "./model/cached.ts";
import type { LiveModels, RunnerOptions } from "./run.ts";

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

/** `child` is `parent` or inside it. */
const within = (parent: string, child: string) => {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

const offline = (env: NodeJS.ProcessEnv) => env.ENGRAM_OFFLINE === "1";

/** The named model's live cassette directory, checked against the rules above. */
function liveCassettes(config: RunnerConfig, request: LiveRunRequest): string {
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
      join(request.repo, ".engram", "runs", `${config.name}-live`, ...parts, "cassettes"),
  );
  for (const committed of [join(request.repo, "fixtures"), config.cassettes]) {
    if (within(committed, cassettes) || within(cassettes, committed)) {
      throw new LiveRunRefused(
        `cassette directory ${cassettes} overlaps the committed cassettes at ${resolve(committed)}`,
      );
    }
  }
  const scratch = join(request.repo, ".engram");
  if (
    within(request.repo, cassettes) &&
    !(within(scratch, cassettes) && cassettes !== resolve(scratch))
  ) {
    throw new LiveRunRefused(
      `cassette directory ${cassettes} is inside the repository but not under ${resolve(scratch)}; live cassettes go under .engram/ or outside the repository`,
    );
  }
  return cassettes;
}

/**
 * The config a live run records with: the request's model and its live
 * cassette directory. Throws LiveRunRefused on any guard.
 */
export function liveConfig(config: RunnerConfig, request: LiveRunRequest): RunnerConfig {
  if (offline(request.env ?? process.env)) {
    throw new LiveRunRefused("ENGRAM_OFFLINE=1 is set, and a live run reaches a model");
  }
  return { ...config, model: request.model, cassettes: liveCassettes(config, request) };
}

/**
 * The config that replays a live run's cassettes: the same model and
 * directory, allowed offline; the directory must exist.
 */
export function replayConfig(config: RunnerConfig, request: LiveRunRequest): RunnerConfig {
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

/**
 * The runner options of a live run: record misses from `live` into the
 * config's cassettes. Refuses under ENGRAM_OFFLINE=1, a second defence after
 * `liveConfig`.
 */
export function liveOptions(
  config: RunnerConfig,
  live: LiveModels,
  env: NodeJS.ProcessEnv = process.env,
): RunnerOptions {
  if (offline(env)) {
    throw new LiveRunRefused("ENGRAM_OFFLINE=1 is set, and a live run reaches a model");
  }
  return { cache: fileCache(config.cassettes), offline: false, live };
}

/** The runner options of a replay: the config's cassettes only, every miss an error. */
export function replayOptions(config: RunnerConfig): RunnerOptions {
  return { cache: fileCache(config.cassettes), offline: true };
}
