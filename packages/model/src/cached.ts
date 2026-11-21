// Every model call is cached, metered and seeded (ADR 0017). The cache key is
// (benchmark item, condition, preset, store, model, seed, prompt hash); a rerun
// with the same config makes zero new calls, and with ENGRAM_OFFLINE=1 a miss
// is an error, so CI and replay never reach the network. A file cache is the
// cassette set under fixtures/cassettes/.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  canonicalJson,
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

/**
 * A response with the upstream provider that served it, when a gateway
 * (OpenRouter) reports one (card RV6, RV-DES-11). Not part of any key; a
 * cassette recorded without it replays unchanged.
 */
export interface ServedResponse extends ModelResponse {
  upstream?: string;
}

/**
 * A message the ModelRequest shape cannot hold, carried as the harness sent
 * it (card B10): a tool result, an assistant turn with tool calls, a system
 * message after the first, content in parts.
 */
export interface ChatMessage {
  role: string;
  [field: string]: unknown;
}

/**
 * A ModelRequest widened with what a tool-use harness sends through the
 * cassette proxy (card B10): messages the ModelRequest shape cannot hold, the
 * tool definitions, the tool choice, and any other answer-changing parameter
 * the proxy carries verbatim. Every field is part of the prompt hash; with
 * none of them set it is a ModelRequest and hashes as one, so a ModelRequest
 * is a ChatRequest.
 */
export interface ChatRequest extends Omit<ModelRequest, "messages"> {
  messages: (ModelRequest["messages"][number] | ChatMessage)[];
  /** OpenAI's `tools`, unchanged. */
  tools?: unknown[];
  /** OpenAI's `tool_choice`, unchanged. */
  toolChoice?: unknown;
  /** Every other request parameter the proxy received (`top_p`, `stop`, ...), unchanged. */
  params?: Record<string, unknown>;
}

/** A reply that may call tools (card B10). A ModelResponse is one with no tool calls. */
export interface ChatResponse extends ServedResponse {
  /** OpenAI's `tool_calls`, unchanged. */
  toolCalls?: unknown[];
  /** OpenAI's `finish_reason`, when the upstream gave one. */
  finishReason?: string;
}

/** A model call that may carry tool use: what the cassette proxy's upstream is. */
export type ChatCall = (request: ChatRequest) => Promise<ChatResponse>;

export interface CacheEntry {
  key: string;
  context: CallContext;
  request: ModelRequest;
  response: ServedResponse;
}

export interface CacheStore {
  /**
   * The folder a file cache writes, so a recording can be refused a committed
   * one (card B10 review B10-8); absent for a cache that writes no file.
   */
  readonly dir?: string;
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
  /** The upstream provider that served the call (a hit: the one that served the recording), when known. */
  upstream?: string;
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
      `offline (ENGRAM_OFFLINE=1, or a replay) and no cassette for key ${key} (item ${context.item}, condition ${context.condition}, preset ${context.preset}, store ${context.store}); record it first (make fixtures for a scripted model)`,
    );
    this.key = key;
  }
}

/**
 * A live call that failed for a transient reason (a 429, a 5xx, a network
 * error) after its retry (card RV1, review RV1-1): it stops the run like an
 * offline miss, it is never recorded, and a rerun or a resume makes the call
 * again. A failure that is not transient is a reply, recorded where its
 * caller goes on past it (GateMem's judge).
 */
export class TransientCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientCallError";
  }
}

/**
 * ADR 0017's key. A ChatRequest (card B10) is hashed whole, as
 * `requestHash` hashes a ModelRequest: canonical JSON of every field, so its
 * tool definitions and messages are in the prompt hash, and a ChatRequest
 * with none of the widened fields set has the key of the same ModelRequest.
 */
export function cacheKey(context: CallContext, request: ChatRequest): string {
  return sha256(
    canonicalJson({
      ...context,
      model: request.model,
      seed: request.seed,
      // requestHash is canonical JSON of the whole value; the widened fields are hashed with the rest.
      prompt: requestHash(request as ModelRequest),
    }),
  );
}

export function cached<
  Req extends ChatRequest = ModelRequest,
  Res extends ModelResponse = ModelResponse,
>(inner: (request: Req) => Promise<Res>, options: CachedOptions): (request: Req) => Promise<Res> {
  const offline = () => options.offline ?? process.env.ENGRAM_OFFLINE === "1";
  /** Calls in flight by key, so concurrent identical calls reach the model once. */
  const pending = new Map<string, Promise<Res>>();
  return async (request) => {
    const key = cacheKey(options.context, request);
    const hit = options.cache.get(key);
    let response: Res;
    if (hit) {
      // An entry holds the response its call recorded, a ChatResponse's tool calls included.
      response = hit.response as Res;
    } else {
      if (offline()) throw new OfflineMissError(key, options.context);
      let flight = pending.get(key);
      if (!flight) {
        flight = inner(request).then((r) => {
          // A ChatRequest is stored whole; the entry's type names the ModelRequest fields its readers use.
          options.cache.set({
            key,
            context: options.context,
            request: request as ModelRequest,
            response: r,
          });
          return r;
        });
        pending.set(key, flight);
        void flight.finally(() => pending.delete(key)).catch(() => {});
      }
      response = await flight;
    }
    const upstream = (response as ServedResponse).upstream;
    const base = { key, model: request.model };
    const served = upstream === undefined ? {} : { upstream };
    options.onUsage?.(
      hit
        ? {
            ...base,
            hit: true,
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: 0,
            cached: response.usage,
            ...served,
          }
        : { ...base, hit: false, ...response.usage, ...served },
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
 * and are renamed into place. It creates `dir` (and its parents) when called,
 * before any write: code that records into a folder runs `recordingRefusal`
 * on it before building the cache, so a refused folder is never created.
 */
export function fileCache(dir: string): CacheStore {
  mkdirSync(dir, { recursive: true });
  const path = (key: string) => join(dir, `${key}.json`);
  return {
    dir: resolve(dir),
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
