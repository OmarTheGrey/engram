// Every model call is cached, metered and seeded (ADR 0017). The cache key is
// (benchmark item, condition, preset, store, model, seed, prompt hash); a rerun
// with the same config makes zero new calls, and with ENGRAM_OFFLINE=1 a miss
// is an error, so CI and replay never reach the network. A file cache is the
// cassette set under fixtures/cassettes/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  canonicalJson,
  type ModelCall,
  type ModelRequest,
  type ModelResponse,
  requestHash,
  sha256,
} from "@engram/core";

/** Where a call happens in an experiment. */
export interface CallContext {
  item: string;
  condition: string;
  preset: string;
  store: string;
}

export interface CacheEntry {
  key: string;
  context: CallContext;
  request: ModelRequest;
  response: ModelResponse;
}

export interface CacheStore {
  get(key: string): CacheEntry | undefined;
  set(entry: CacheEntry): void;
}

export interface UsageRecord {
  key: string;
  model: string;
  hit: boolean;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface CachedOptions {
  cache: CacheStore;
  context: CallContext;
  /** Refuse misses. Defaults to ENGRAM_OFFLINE=1. */
  offline?: boolean;
  /** Called once per call with its usage, for the cost ledger. */
  onUsage?: (usage: UsageRecord) => void;
}

export class OfflineMissError extends Error {
  readonly key: string;

  constructor(key: string, context: CallContext) {
    super(
      `ENGRAM_OFFLINE=1 and no cassette for key ${key} (item ${context.item}, condition ${context.condition}, preset ${context.preset}, store ${context.store}); record it online first`,
    );
    this.key = key;
  }
}

export function cacheKey(context: CallContext, request: ModelRequest): string {
  return sha256(
    canonicalJson({
      ...context,
      model: request.model,
      seed: request.seed,
      prompt: requestHash(request),
    }),
  );
}

export function cached(inner: ModelCall, options: CachedOptions): ModelCall {
  const offline = options.offline ?? process.env.ENGRAM_OFFLINE === "1";
  return async (request) => {
    const key = cacheKey(options.context, request);
    const hit = options.cache.get(key);
    let response: ModelResponse;
    if (hit) {
      response = hit.response;
    } else {
      if (offline) throw new OfflineMissError(key, options.context);
      response = await inner(request);
      options.cache.set({ key, context: options.context, request, response });
    }
    options.onUsage?.({ key, model: request.model, hit: hit !== undefined, ...response.usage });
    return response;
  };
}

export function memoryCache(): CacheStore {
  const entries = new Map<string, CacheEntry>();
  return {
    get: (key) => entries.get(key),
    set: (entry) => {
      entries.set(entry.key, entry);
    },
  };
}

/** One JSON file per entry, named by key: the cassette format. */
export function fileCache(dir: string): CacheStore {
  mkdirSync(dir, { recursive: true });
  const path = (key: string) => join(dir, `${key}.json`);
  return {
    get(key) {
      try {
        return JSON.parse(readFileSync(path(key), "utf8")) as CacheEntry;
      } catch {
        return undefined;
      }
    },
    set(entry) {
      writeFileSync(path(entry.key), `${JSON.stringify(entry, null, 2)}\n`);
    },
  };
}
