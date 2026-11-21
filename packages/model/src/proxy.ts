// The cassette proxy (card B10, ADR 0036): a loopback server that speaks
// OpenAI's chat-completions API and serves every request through the same
// cached, seeded call as the runner (ADR 0017), so a Python harness that
// reaches its model through LiteLLM (MERIT, tau2-bench) obeys AGENTS.md
// rules 6 and 7 without being ported.
//
//   POST /v1/chat/completions   one call, answered from the cassettes
//   POST /v1/embeddings         501 until a harness card needs it
//   anything else               404 (405 for another method on the chat route)
//
// The key is ADR 0017's, computed by `cacheKey`, the function the runner's
// calls are keyed by. The cell of the experiment (harness, item, condition,
// preset, store, seed) comes from the proxy's start-up configuration and the
// request's `x-engram-*` headers: a header fills a field the configuration
// leaves open and must agree with one it fixes. The harness qualifies the
// item (`<harness>/<item>`), so two harnesses never share a key.
//
// Modes, as the runner has them (packages/runner/src/live.ts): replay by
// default (record mode `none`), where a miss is a 404 returned to the harness
// and recorded in `errors`; `new_episodes` (vcrpy's name for it, idea only,
// MIT) answers a miss from the injected upstream and records it, and is
// refused under ENGRAM_OFFLINE=1. vcrpy's `all` is not offered: it would make
// a rerun call the model again (rule 7). `once` is not offered either: the
// runner has no mode that refuses a new call into a folder already recorded.
//
// The tool use of a tool-use harness passes through: a request's `tools` and
// `tool_choice`, the history's tool messages, and a reply's `tool_calls` are
// carried unchanged and are in the prompt hash (ChatRequest, cached.ts). Every
// other request parameter is carried verbatim in `params`, so nothing that
// changes the answer is left out of the key. Each reply says whether it was
// a cache hit in `x-engram-cache-hit` and names its key in
// `x-engram-cache-key` (LiteLLM's cache headers, idea only, MIT).
//
// Usage goes to `onUsage` as the runner's UsageRecord, so the caller writes it
// to the runner's ledger (usage.jsonl, card RV1) and cost accounting needs
// nothing new. The proxy itself picks no cassette folder and opens no
// ledger: the harness cards (B7, B11) wire it to the runner's live guards.
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { canonicalJson, type ModelRequest, UnsupportedRequestError } from "@engram/core";
import {
  type CachedOptions,
  type CacheStore,
  type CallContext,
  type ChatCall,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  cached,
  cacheKey,
  OfflineMissError,
  TransientCallError,
  type UsageRecord,
} from "./cached.ts";

/** vcrpy's record modes the proxy offers: replay only, or record what is not yet recorded. */
export type RecordMode = "none" | "new_episodes";

const RECORD_MODES: readonly string[] = ["none", "new_episodes"];

/** The experiment cell a call belongs to: with the model and the prompt hash, ADR 0017's key. */
export interface ProxyContext {
  harness: string;
  item: string;
  condition: string;
  preset: string;
  store: string;
  seed: number;
}

/** The request header that carries each cell field. */
export const CONTEXT_HEADERS: Readonly<Record<keyof ProxyContext, string>> = {
  harness: "x-engram-harness",
  item: "x-engram-item",
  condition: "x-engram-condition",
  preset: "x-engram-preset",
  store: "x-engram-store",
  seed: "x-engram-seed",
};

const FIELDS = Object.keys(CONTEXT_HEADERS) as (keyof ProxyContext)[];

/** A harness name: no slash, so `<harness>/<item>` cannot be read two ways. */
const HARNESS = /^[A-Za-z0-9._-]+$/;
const SEED = /^(0|[1-9][0-9]*)$/;

/** The cache's CallContext of a cell: the harness qualifies the item. */
export function proxyCallContext(cell: ProxyContext): CallContext {
  return {
    item: `${cell.harness}/${cell.item}`,
    condition: cell.condition,
    preset: cell.preset,
    store: cell.store,
  };
}

/** The proxy would not start as configured. */
export class ProxyRefused extends Error {
  constructor(message: string) {
    super(`cassette proxy refused: ${message}`);
    this.name = "ProxyRefused";
  }
}

/** A request the proxy answers with an error status instead of a completion. */
export class ProxyRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly key: string | undefined;

  constructor(status: number, code: string, message: string, key?: string) {
    super(message);
    this.name = "ProxyRequestError";
    this.status = status;
    this.code = code;
    this.key = key;
  }
}

/** A failure of the upstream model that is not transient: returned, never recorded. */
class UpstreamFailed extends Error {
  constructor(cause: unknown) {
    super(`upstream model call failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "UpstreamFailed";
  }
}

/** One request the proxy did not answer with a completion. */
export interface ProxyError {
  status: number;
  code: string;
  message: string;
  /** The call's cache key, once the request was read far enough to have one. */
  key?: string;
}

export interface ProxyOptions {
  /** The cassettes: a file cache over the run's cassette folder, or a memory cache in tests. */
  cache: CacheStore;
  /** The cell fields every request shares; a header fills what this leaves out. */
  context?: Partial<ProxyContext>;
  /** `none` (the default) replays only; `new_episodes` records a miss from `upstream`. */
  record?: RecordMode;
  /** Answers a miss in record mode: the live model, or a scripted one in tests. */
  upstream?: ChatCall;
  /** Each call's usage, for the runner's ledger (card RV1). */
  onUsage?: (usage: UsageRecord) => void;
  /** Each request not answered with a completion (a miss included), as it happens. */
  onError?: (error: ProxyError) => void;
  /** The port on 127.0.0.1; 0 (the default) picks a free one. */
  port?: number;
  /** Where ENGRAM_OFFLINE is read; the process environment by default. */
  env?: NodeJS.ProcessEnv;
  /** The largest request body read, in bytes; 64 MiB by default. */
  maxBodyBytes?: number;
}

export interface ProxyHandle {
  server: Server;
  port: number;
  /** `http://127.0.0.1:<port>`. */
  url: string;
  /** `http://127.0.0.1:<port>/v1`: what a harness's OpenAI base URL is set to. */
  baseUrl: string;
  /** Every request not answered with a completion, in order: a run with a miss here did not replay. */
  errors: ProxyError[];
  /** Stops listening and drops open connections; calling it again is harmless. */
  close(): Promise<void>;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const bad = (message: string) => new ProxyRequestError(400, "invalid_request", message);

const isPlain = (m: Record<string, unknown>) =>
  typeof m.content === "string" && Object.keys(m).every((k) => k === "role" || k === "content");

/** OpenAI's strict json_schema response format, which a ModelRequest's `responseSchema` stands for. */
function strictSchema(format: unknown): ModelRequest["responseSchema"] {
  if (!isObject(format) || format.type !== "json_schema") return undefined;
  if (!Object.keys(format).every((k) => k === "type" || k === "json_schema")) return undefined;
  const spec = format.json_schema;
  if (!isObject(spec) || spec.strict !== true) return undefined;
  if (!Object.keys(spec).every((k) => k === "name" || k === "schema" || k === "strict")) {
    return undefined;
  }
  if (typeof spec.name !== "string" || !isObject(spec.schema)) return undefined;
  return { name: spec.name, schema: spec.schema };
}

/**
 * The request the proxy keys and records for an OpenAI chat-completions
 * body under the experiment's `seed`. What a ModelRequest can hold is put
 * where the runner puts it: a leading system message with text only is
 * `system`, user and assistant messages with text only are ModelRequest
 * messages, `temperature`, `max_tokens` and a strict `json_schema` response
 * format are `temperature`, `maxTokens` and `responseSchema`. So a call the
 * runner could make has the runner's key. Everything else is carried as
 * sent: other messages, `tools`, `tool_choice`, and every other parameter in
 * `params`. A null parameter, `stream: false` and `n: 1` are OpenAI's
 * defaults and are dropped; a body `seed` must be the experiment's.
 */
export function chatRequest(body: unknown, seed: number): ChatRequest {
  if (!isObject(body)) throw bad("the request body is not a JSON object");
  const given = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== null));
  const {
    model,
    messages,
    temperature,
    max_tokens,
    response_format,
    tools,
    tool_choice,
    seed: sent,
    stream,
    n,
    ...rest
  } = given;
  if (stream !== undefined && stream !== false) {
    throw new ProxyRequestError(
      501,
      "not_implemented",
      "streaming is not served: the cassette proxy answers a whole completion; send stream false (a harness card adds streaming when it needs it)",
    );
  }
  if (typeof model !== "string" || model === "") throw bad("model must be a non-empty string");
  if (!Array.isArray(messages)) throw bad("messages must be an array");
  if (n !== undefined && n !== 1) throw bad("n must be 1: a cassette holds one reply per key");
  if (sent !== undefined && sent !== seed) {
    throw bad(`the request's seed ${JSON.stringify(sent)} is not the experiment's seed ${seed}`);
  }
  if (temperature !== undefined && typeof temperature !== "number") {
    throw bad("temperature must be a number");
  }
  if (max_tokens !== undefined && !Number.isSafeInteger(max_tokens)) {
    throw bad("max_tokens must be an integer");
  }
  if (tools !== undefined && !Array.isArray(tools)) throw bad("tools must be an array");

  let system: string | undefined;
  const out: ChatRequest["messages"] = [];
  for (const [i, m] of messages.entries()) {
    if (!isObject(m) || typeof m.role !== "string") throw bad(`message ${i} has no role`);
    if (i === 0 && m.role === "system" && isPlain(m)) {
      system = m.content as string;
    } else if ((m.role === "user" || m.role === "assistant") && isPlain(m)) {
      out.push({ role: m.role, content: m.content as string });
    } else {
      out.push(m as ChatMessage);
    }
  }
  const responseSchema = strictSchema(response_format);
  const params = { ...rest };
  if (response_format !== undefined && responseSchema === undefined) {
    params.response_format = response_format;
  }
  return {
    model,
    ...(system === undefined ? {} : { system }),
    messages: out,
    seed,
    ...(temperature === undefined ? {} : { temperature: temperature as number }),
    ...(max_tokens === undefined ? {} : { maxTokens: max_tokens as number }),
    ...(responseSchema === undefined ? {} : { responseSchema }),
    ...(tools === undefined ? {} : { tools: tools as unknown[] }),
    ...(tool_choice === undefined ? {} : { toolChoice: tool_choice }),
    ...(Object.keys(params).length === 0 ? {} : { params }),
  };
}

/**
 * The chat-completions body of a reply. Nothing in it depends on whether it
 * was recorded or replayed (the usage is the recorded call's, the id comes
 * from the key, `created` is 0), so a harness writes the same output on a
 * replay as on the live run.
 */
export function chatCompletion(key: string, model: string, response: ChatResponse) {
  const calls = response.toolCalls !== undefined && response.toolCalls.length > 0;
  return {
    id: `chatcmpl-${key.slice(0, 32)}`,
    object: "chat.completion",
    created: 0,
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: calls && response.text === "" ? null : response.text,
          ...(calls ? { tool_calls: response.toolCalls } : {}),
        },
        finish_reason: response.finishReason ?? (calls ? "tool_calls" : "stop"),
      },
    ],
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}

/** The cell of one request: the configuration's fields, filled and checked by its headers. */
function cellOf(headers: IncomingHttpHeaders, fixed: Partial<ProxyContext>): ProxyContext {
  const cell: Partial<Record<keyof ProxyContext, string | number>> = {};
  for (const field of FIELDS) {
    const header = CONTEXT_HEADERS[field];
    const raw = headers[header];
    if (Array.isArray(raw)) throw bad(`header ${header} is sent more than once`);
    let value: string | number | undefined = raw;
    if (raw !== undefined && field === "seed") {
      if (!SEED.test(raw) || !Number.isSafeInteger(Number(raw))) {
        throw bad(`header ${header} must be a non-negative integer, not ${JSON.stringify(raw)}`);
      }
      value = Number(raw);
    }
    if (field === "harness" && typeof value === "string" && !HARNESS.test(value)) {
      throw bad(`header ${header} must match ${HARNESS}, not ${JSON.stringify(value)}`);
    }
    const set = fixed[field];
    if (set !== undefined && value !== undefined && value !== set) {
      throw bad(
        `header ${header} says ${JSON.stringify(value)}, and the proxy's configuration fixes ${field} at ${JSON.stringify(set)}`,
      );
    }
    const chosen = value ?? set;
    if (chosen === undefined || chosen === "") {
      throw bad(`no ${field}: the proxy's configuration leaves it open and ${header} is not sent`);
    }
    cell[field] = chosen;
  }
  return cell as unknown as ProxyContext;
}

/** The configured cell fields, checked once at start. */
function checkedContext(context: Partial<ProxyContext>): Partial<ProxyContext> {
  for (const field of FIELDS) {
    const value = context[field];
    if (value === undefined) continue;
    if (field === "seed") {
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new ProxyRefused(`the seed must be a non-negative integer, not ${String(value)}`);
      }
    } else if (typeof value !== "string" || value === "") {
      throw new ProxyRefused(`${field} must be a non-empty string`);
    }
  }
  if (context.harness !== undefined && !HARNESS.test(context.harness)) {
    throw new ProxyRefused(`the harness must match ${HARNESS}, not ${context.harness}`);
  }
  return { ...context };
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
    });
    req.on("end", () => {
      if (size > limit) {
        reject(new ProxyRequestError(413, "too_large", `the request body is over ${limit} bytes`));
      } else {
        resolve(Buffer.concat(chunks));
      }
    });
    req.on("error", reject);
  });
}

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const text = canonicalJson(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(text)),
    ...headers,
  });
  res.end(text);
}

/** What an error thrown while serving a request is answered with. */
function asRequestError(e: unknown, key: string | undefined): ProxyRequestError {
  if (e instanceof ProxyRequestError) return e;
  if (e instanceof OfflineMissError) {
    return new ProxyRequestError(
      404,
      "cassette_miss",
      `${e.message}; the proxy replays only (record mode none) or ENGRAM_OFFLINE=1 is set`,
      e.key,
    );
  }
  if (e instanceof TransientCallError) {
    return new ProxyRequestError(503, "upstream_unavailable", e.message, key);
  }
  if (e instanceof UnsupportedRequestError) {
    return new ProxyRequestError(400, "unsupported_request", e.message, key);
  }
  if (e instanceof UpstreamFailed) {
    // Not a 5xx: an OpenAI client retries those, and each retry would be paid for.
    return new ProxyRequestError(422, "upstream_error", e.message, key);
  }
  return new ProxyRequestError(500, "proxy_error", (e as Error)?.message ?? String(e), key);
}

/**
 * Starts the proxy on 127.0.0.1. Refused for a record mode it does not
 * offer, for recording under ENGRAM_OFFLINE=1 or without an upstream, and
 * for a configured cell field that is malformed.
 */
export async function startProxy(options: ProxyOptions): Promise<ProxyHandle> {
  const record: string = options.record ?? "none";
  if (!RECORD_MODES.includes(record)) {
    throw new ProxyRefused(
      `record mode ${record} is not offered; use none (replay, the default) or new_episodes (record what is missing); vcrpy's all would call the model again on a rerun (AGENTS.md rule 7)`,
    );
  }
  const env = options.env ?? process.env;
  const offline = () => env.ENGRAM_OFFLINE === "1";
  if (record === "new_episodes") {
    if (offline()) {
      throw new ProxyRefused("ENGRAM_OFFLINE=1 is set, and recording reaches a model");
    }
    if (options.upstream === undefined) {
      throw new ProxyRefused("record mode new_episodes needs an upstream to answer a miss");
    }
  }
  const fixed = checkedContext(options.context ?? {});
  const limit = options.maxBodyBytes ?? 64 * 1024 * 1024;
  const upstream = options.upstream;
  const errors: ProxyError[] = [];

  const answer: ChatCall = async (request) => {
    if (upstream === undefined) throw new Error("no upstream: the proxy replays only");
    try {
      return await upstream(request);
    } catch (e) {
      if (e instanceof TransientCallError || e instanceof UnsupportedRequestError) throw e;
      throw new UpstreamFailed(e);
    }
  };
  /** One cached call per cell, so concurrent identical calls reach the upstream once. */
  const calls = new Map<string, ChatCall>();
  const callFor = (context: CallContext): ChatCall => {
    const id = canonicalJson(context);
    let call = calls.get(id);
    if (call === undefined) {
      const cachedOptions: CachedOptions = {
        cache: options.cache,
        context,
        // Read on every call: replay refuses every miss, and so does recording once ENGRAM_OFFLINE=1 is set.
        get offline() {
          return record === "none" || offline();
        },
        ...(options.onUsage === undefined ? {} : { onUsage: options.onUsage }),
      };
      call = cached<ChatRequest, ChatResponse>(answer, cachedOptions);
      calls.set(id, call);
    }
    return call;
  };

  const complete = async (req: IncomingMessage, res: ServerResponse) => {
    const text = (await readBody(req, limit)).toString("utf8");
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch (e) {
      throw bad(`the request body is not JSON: ${(e as Error).message}`);
    }
    const cell = cellOf(req.headers, fixed);
    const context = proxyCallContext(cell);
    const request = chatRequest(body, cell.seed);
    const key = cacheKey(context, request);
    const hit = options.cache.get(key) !== undefined;
    let response: ChatResponse;
    try {
      response = await callFor(context)(request);
    } catch (e) {
      throw asRequestError(e, key);
    }
    send(res, 200, chatCompletion(key, request.model, response), {
      "x-engram-cache-hit": String(hit),
      "x-engram-cache-key": key,
    });
  };

  const serve = async (req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (path === "/v1/chat/completions") {
      if (req.method !== "POST") {
        throw new ProxyRequestError(
          405,
          "method_not_allowed",
          `${req.method} is not served on ${path}; send POST`,
        );
      }
      return complete(req, res);
    }
    if (path === "/v1/embeddings") {
      throw new ProxyRequestError(
        501,
        "not_implemented",
        "embeddings are not served by the cassette proxy yet; a harness card adds them when it needs them",
      );
    }
    throw new ProxyRequestError(
      404,
      "not_found",
      `no route ${path}; the cassette proxy serves POST /v1/chat/completions`,
    );
  };

  const server = createServer((req, res) => {
    serve(req, res).catch((e: unknown) => {
      const failure = asRequestError(e, undefined);
      const error: ProxyError = {
        status: failure.status,
        code: failure.code,
        message: failure.message,
        ...(failure.key === undefined ? {} : { key: failure.key }),
      };
      errors.push(error);
      options.onError?.(error);
      req.resume();
      if (res.headersSent) {
        res.end();
        return;
      }
      send(res, failure.status, {
        error: { message: failure.message, type: failure.code, code: failure.code, param: null },
      });
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const port = (server.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${port}`;
  let closing: Promise<void> | undefined;
  return {
    server,
    port,
    url,
    baseUrl: `${url}/v1`,
    errors,
    close() {
      closing ??= new Promise<void>((resolve, reject) => {
        server.close((e) => (e ? reject(e) : resolve()));
        server.closeAllConnections();
      });
      return closing;
    },
  };
}

/** A harness endpoint that is not the cassette proxy. */
export class HarnessEndpointRefused extends Error {
  constructor(endpoint: unknown, reason: string) {
    super(
      `harness endpoint ${JSON.stringify(endpoint ?? null)} is not the cassette proxy: ${reason}. A harness reaches its model only through the proxy (ADR 0036); this is a check of the configuration, not a network control`,
    );
    this.name = "HarnessEndpointRefused";
  }
}

/**
 * The check a research config runs on its harness's model endpoint (the
 * OpenAI base URL LiteLLM is given), returning it normalised as
 * `http://127.0.0.1:<port>/v1`. Before the proxy starts it refuses anything
 * that cannot be the proxy (another host or scheme, credentials, a query, no
 * port, a path other than `/v1`); given the running proxy, anything that is
 * not its base URL. ADR 0036 states the limit: this checks what the harness
 * was configured with, and cannot stop a harness that ignores its
 * configuration from opening a connection of its own.
 */
export function checkHarnessEndpoint(
  endpoint: unknown,
  proxy?: Pick<ProxyHandle, "baseUrl">,
): string {
  if (typeof endpoint !== "string" || endpoint === "") {
    throw new HarnessEndpointRefused(endpoint, "no endpoint is set");
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new HarnessEndpointRefused(endpoint, "it is not a URL");
  }
  if (url.protocol !== "http:") {
    throw new HarnessEndpointRefused(endpoint, "the proxy speaks plain http on loopback");
  }
  if (url.hostname !== "127.0.0.1") {
    throw new HarnessEndpointRefused(endpoint, "the proxy listens on 127.0.0.1 only");
  }
  if (url.username !== "" || url.password !== "") {
    throw new HarnessEndpointRefused(endpoint, "it carries credentials");
  }
  if (url.search !== "" || url.hash !== "") {
    throw new HarnessEndpointRefused(endpoint, "it carries a query or a fragment");
  }
  if (url.port === "") throw new HarnessEndpointRefused(endpoint, "it names no port");
  if (url.pathname !== "/v1" && url.pathname !== "/v1/") {
    throw new HarnessEndpointRefused(endpoint, "the proxy's base path is /v1");
  }
  const normal = `http://127.0.0.1:${url.port}/v1`;
  if (proxy !== undefined && normal !== proxy.baseUrl) {
    throw new HarnessEndpointRefused(endpoint, `the proxy serving this run is ${proxy.baseUrl}`);
  }
  return normal;
}
