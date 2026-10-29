// The live half of Gate B criterion 4, exception (c) (card B3, plan decision
// 1): the same probes on a named model, recorded into a new cassette
// directory outside the committed fixtures. Nothing here runs until the
// pre-registration names the primary model and the lead supplies its key;
// no test reaches a provider (pi-ai's faux provider stands in for one).
//
//   make run CONFIG=research/configs/b3-gatemem-plane.json MODEL=<provider/model> LIVE=1
//
// Guards, each refused before any session starts:
// - ENGRAM_OFFLINE=1 refuses: offline means no model is reached.
// - A scripted model refuses: a script is recorded by `make fixtures` only.
// - The cassette directory must lie outside every committed fixture
//   (`fixtures/` of the repository, and the config's own cassettes); the
//   default is `.engram/runs/<config>-live/<provider>/<model>/cassettes`, which
//   .gitignore keeps out of the repository. A rerun replays what it recorded.
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
  /** The repository root: its `fixtures/` folder is never written. */
  repo: string;
  /** Where the new cassettes go; default under `<repo>/.engram/runs/`. */
  cassettes?: string;
  env?: NodeJS.ProcessEnv;
}

const SAFE_PART = /^[A-Za-z0-9._-]+$/;

/** `child` is `parent` or inside it. */
const within = (parent: string, child: string) => {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

/**
 * The config a live run uses: the request's model and a cassette directory
 * outside the committed fixtures. Throws LiveRunRefused on any guard.
 */
export function liveConfig(config: RunnerConfig, request: LiveRunRequest): RunnerConfig {
  const env = request.env ?? process.env;
  if (env.ENGRAM_OFFLINE === "1") {
    throw new LiveRunRefused("ENGRAM_OFFLINE=1 is set, and a live run reaches a model");
  }
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
  return { ...config, model: request.model, cassettes };
}

/** pi-ai's built-in providers, reading their keys from the environment as pi-ai does. */
export function builtinLiveModels(): LiveModels {
  const models = createModels();
  for (const provider of builtinProviders()) models.setProvider(provider);
  return models;
}

/** The runner options of a live run: record misses from `live` into the config's cassettes. */
export function liveOptions(config: RunnerConfig, live: LiveModels): RunnerOptions {
  return { cache: fileCache(config.cassettes), offline: false, live };
}
