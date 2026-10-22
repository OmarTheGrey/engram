// Every model call is cached, metered and seeded (ADR 0017). The cache key is
// (benchmark item, condition, preset, store, model, seed, prompt hash); a rerun
// with the same config makes zero new calls, and with ENGRAM_OFFLINE=1 a miss
// is an error, so CI and replay never reach the network. A file cache is the
// cassette set under fixtures/cassettes/.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  canonicalJson,
  type ModelCall,
  type ModelRequest,
  type ModelResponse,
  type ModelUsage,
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

/**
 * Usage of one call, for the cost ledger. A hit spends nothing, so its tokens
 * and cost are zero and the usage recorded when the cassette was made is in
 * `cached`; summing the ledger therefore counts each paid call once.
 */
export interface UsageRecord {
  key: string;
  model: string;
  hit: boolean;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  cached?: ModelUsage;
}

export interface CachedOptions {
  cache: CacheStore;
  context: CallContext;
  /** Refuse misses. When unset, ENGRAM_OFFLINE=1 is checked on every call. */
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
  const offline = () => options.offline ?? process.env.ENGRAM_OFFLINE === "1";
  /** Calls in flight by key, so concurrent identical calls reach the model once. */
  const pending = new Map<string, Promise<ModelResponse>>();
  return async (request) => {
    const key = cacheKey(options.context, request);
    const hit = options.cache.get(key);
    let response: ModelResponse;
    if (hit) {
      response = hit.response;
    } else {
      if (offline()) throw new OfflineMissError(key, options.context);
      let flight = pending.get(key);
      if (!flight) {
        flight = inner(request).then((r) => {
          options.cache.set({ key, context: options.context, request, response: r });
          return r;
        });
        pending.set(key, flight);
        void flight.finally(() => pending.delete(key)).catch(() => {});
      }
      response = await flight;
    }
    const base = { key, model: request.model };
    options.onUsage?.(
      hit
        ? {
            ...base,
            hit: true,
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: 0,
            cached: response.usage,
          }
        : { ...base, hit: false, ...response.usage },
    );
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

/**
 * One JSON file per entry, named by key: the cassette format. Only a missing
 * file is a miss; a file that does not parse is an error, so a damaged
 * cassette is never silently paid for again. Writes go to a temporary file
 * and are renamed into place.
 */
export function fileCache(dir: string): CacheStore {
  mkdirSync(dir, { recursive: true });
  const path = (key: string) => join(dir, `${key}.json`);
  return {
    get(key) {
      let text: string;
      try {
        text = readFileSync(path(key), "utf8");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw e;
      }
      try {
        return JSON.parse(text) as CacheEntry;
      } catch (e) {
        throw new Error(`corrupt cassette ${path(key)}: ${(e as Error).message}`);
      }
    },
    set(entry) {
      const target = path(entry.key);
      const temporary = `${target}.${process.pid}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(entry, null, 2)}\n`);
      renameSync(temporary, target);
    },
  };
}
