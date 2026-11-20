// The MCP server's two transports (card E8.4): stdio, which Claude Code and
// Codex launch as a child process, and streamable HTTP on a loopback port.
// The MCP specification asks a local streamable HTTP server to validate
// `Origin` and bind to localhost; it runs behind the HTTP API's own loopback
// guard (Host a loopback name with the port, a present Origin the server's
// own, bodies application/json; ADR 0027 decision 4), and refuses any host
// that is not loopback before binding.
//
// Card RV5: the HTTP transport keeps one server per MCP session (RV-SRF-6:
// a stateless transport built a server per request, so memory_simulate
// replayed an empty workload), and stdio answers the calls in flight when
// its input ends before it closes (RV-SRF-7: their replies were dropped,
// though their writes had committed). Review fix pass of PR #59 (RV5-5):
// HTTP sessions are capped, the least recently used evicted, idle ones
// expired at an injectable clock, and an ended session's next request is
// told why; stdio's drain timer is injectable.
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Readable, Writable } from "node:stream";
import {
  isLoopbackAddress,
  isLoopbackHost,
  LOOPBACK_HOSTS,
  loopbackGuard,
  MAX_BODY_BYTES,
  notLoopbackBound,
  UsageError,
} from "@engram/server";
import { serve } from "@hono/node-server";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

/** The path the streamable HTTP endpoint answers on. */
export const MCP_PATH = "/mcp";

/** How long stdio waits, after its input ends, for the replies of calls in flight. */
export const STDIO_DRAIN_MS = 30_000;

/** The timer stdio's drain waits on; injected by tests (review fix pass of PR #59, RV5-5). */
export interface DrainTimers {
  setTimeout(fire: () => void, ms: number): unknown;
  clearTimeout(timer: unknown): void;
}

/**
 * Serves `server` over stdio until the client closes the stream or `stop` is
 * aborted. When the input ends, the calls already received are answered
 * first (up to STDIO_DRAIN_MS), so a client that writes its last request and
 * closes its end still gets the reply; `stop` closes at once.
 */
export async function serveStdio(
  server: Server,
  stdin: Readable,
  stdout: Writable,
  stop?: AbortSignal,
  timers: DrainTimers = { setTimeout, clearTimeout },
): Promise<void> {
  const transport = new StdioServerTransport(stdin, stdout);
  const closed = new Promise<"end" | "close">((done) => {
    transport.onclose = () => done("close");
    stdin.once("end", () => done("end"));
    stop?.addEventListener("abort", () => done("close"), { once: true });
  });
  // Requests received and not yet answered, counted at the transport. The
  // counters are in place before connect, which starts reading: input that
  // is already waiting is read at once.
  let inFlight = 0;
  let drained: (() => void) | undefined;
  let receive: StdioServerTransport["onmessage"];
  Object.defineProperty(transport, "onmessage", {
    configurable: true,
    get: (): StdioServerTransport["onmessage"] =>
      receive === undefined
        ? undefined
        : (message) => {
            if ("method" in message && "id" in message) inFlight++;
            receive?.(message);
          },
    set: (handler: StdioServerTransport["onmessage"]) => {
      receive = handler;
    },
  });
  const send = transport.send.bind(transport);
  transport.send = async (message) => {
    await send(message);
    if (!("method" in message) && "id" in message && --inFlight <= 0) drained?.();
  };
  await server.connect(transport);
  if ((await closed) === "end" && inFlight > 0 && !stop?.aborted) {
    let timer: unknown;
    await new Promise<void>((done) => {
      drained = done;
      timer = timers.setTimeout(done, STDIO_DRAIN_MS);
      stop?.addEventListener("abort", () => done(), { once: true });
    });
    timers.clearTimeout(timer);
  }
  await server.close();
}

/** How many MCP sessions the HTTP transport keeps; the least recently used is closed past it. */
export const MAX_HTTP_SESSIONS = 64;

/** How long an MCP session may go without a request before it is closed. */
export const MCP_IDLE_MS = 30 * 60_000;

/** How many ended session ids the transport remembers, to say why each ended. */
const ENDED_KEPT = 1024;

/** The HTTP transport's session limits (review fix pass of PR #59, RV5-5). */
export interface HttpSessionOptions {
  /** Sessions kept at once; the least recently used is evicted past it. Default MAX_HTTP_SESSIONS. */
  maxSessions?: number;
  /** A session with no request for this long is closed. Default MCP_IDLE_MS. */
  idleMs?: number;
  /** The idle clock, in milliseconds; the wall clock unless a test injects one. */
  now?: () => number;
}

const sessionEnded = (message: string) =>
  Response.json({ jsonrpc: "2.0", error: { code: -32001, message }, id: null }, { status: 404 });

interface LiveSession {
  transport: WebStandardStreamableHTTPServerTransport;
  seen: number;
}

/**
 * A Hono app with the streamable HTTP endpoint at MCP_PATH behind the
 * loopback guard. One server and transport per MCP session (the SDK's
 * stateful pattern): an initialize request with no `mcp-session-id` starts
 * one, later requests name it, and a DELETE ends it. A server holds its
 * session's own calls, so memory_simulate replays that session's workload
 * (card RV5, RV-SRF-6). Answers are JSON, not a stream. Session ids are
 * random UUIDs; they identify a session, they do not authenticate it
 * (loopback only, ADR 0027 decision 4).
 *
 * Bounds (review fix pass of PR #59, RV5-5): at most `maxSessions` are kept,
 * the least recently used evicted past it, and one idle for `idleMs` is
 * closed; a request naming an evicted or expired session is answered 404
 * with why, so a client knows to start a new one, where one the server never
 * held is "Session not found". Each session's own steps are bounded by its
 * server (createMcpServer's maxSteps).
 */
export function mcpHttpApp(
  makeServer: () => Server,
  port: number,
  options: HttpSessionOptions = {},
): Hono {
  const maxSessions = options.maxSessions ?? MAX_HTTP_SESSIONS;
  const idleMs = options.idleMs ?? MCP_IDLE_MS;
  const now = options.now ?? Date.now;
  const app = new Hono();
  /** Live sessions, least recently used first (a Map keeps insertion order). */
  const sessions = new Map<string, LiveSession>();
  /** Why each recently ended session ended. */
  const ended = new Map<string, string>();
  const end = (sid: string, why: string) => {
    const live = sessions.get(sid);
    if (live === undefined) return;
    sessions.delete(sid);
    ended.set(sid, why);
    for (const old of [...ended.keys()]) {
      if (ended.size <= ENDED_KEPT) break;
      ended.delete(old);
    }
    void live.transport.close();
  };
  const expireIdle = () => {
    const t = now();
    for (const [sid, live] of [...sessions]) {
      if (t - live.seen > idleMs)
        end(
          sid,
          `Session expired: it had no request for more than ${idleMs} ms (idle) and was closed; start a new session`,
        );
    }
  };
  app.use("*", loopbackGuard(port));
  // The same cap as the HTTP API's (review finding R3-12).
  app.use(
    "*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: () =>
        Response.json(
          {
            error: {
              code: "payload_too_large",
              message: `request bodies are limited to ${MAX_BODY_BYTES} bytes`,
            },
          },
          { status: 413 },
        ),
    }),
  );
  app.all(MCP_PATH, async (c) => {
    expireIdle();
    const id = c.req.header("mcp-session-id");
    if (id !== undefined) {
      const known = sessions.get(id);
      if (known === undefined) return sessionEnded(ended.get(id) ?? "Session not found");
      // The most recently used goes last.
      sessions.delete(id);
      known.seen = now();
      sessions.set(id, known);
      return known.transport.handleRequest(c.req.raw);
    }
    // No session named: the transport answers an initialize request with a
    // new session id and refuses anything else, and only an initialized
    // session is kept.
    const transport: WebStandardStreamableHTTPServerTransport =
      new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sid) => {
          sessions.set(sid, { transport, seen: now() });
          for (const old of [...sessions.keys()]) {
            if (sessions.size <= maxSessions) break;
            end(
              old,
              `Session evicted: the server keeps at most ${maxSessions} sessions and closed this one, the least recently used; start a new session`,
            );
          }
        },
        onsessionclosed: (sid) => {
          sessions.delete(sid);
        },
      });
    transport.onclose = () => {
      if (transport.sessionId !== undefined) sessions.delete(transport.sessionId);
    };
    const server = makeServer();
    await server.connect(transport);
    return transport.handleRequest(c.req.raw);
  });
  return app;
}

export interface HttpListening {
  url: string;
  port: number;
  close(): Promise<void>;
}

/** Serves streamable HTTP on a loopback address; any other host is a UsageError. */
export function serveHttp(
  makeServer: () => Server,
  options: { host?: string; port: number } & HttpSessionOptions,
): Promise<HttpListening> {
  const host = options.host ?? "127.0.0.1";
  if (!isLoopbackHost(host))
    throw new UsageError(
      `${host} is not a loopback address; the MCP server listens on ${LOOPBACK_HOSTS.join(", ")} only`,
    );
  return new Promise((resolveListening, reject) => {
    let app: Hono | undefined;
    const server = serve(
      {
        fetch: (request: Request) =>
          app ? app.fetch(request) : new Response("starting", { status: 503 }),
        hostname: host,
        port: options.port,
      },
      (info: AddressInfo) => {
        if (!isLoopbackAddress(info.address)) {
          server.close();
          reject(notLoopbackBound(info.address));
          return;
        }
        const { host: _host, port: _port, ...limits } = options;
        app = mcpHttpApp(makeServer, info.port, limits);
        const name = host.includes(":") ? `[${host}]` : host;
        resolveListening({
          url: `http://${name}:${info.port}${MCP_PATH}`,
          port: info.port,
          close: () =>
            new Promise((done, fail) => {
              server.close((e) => (e ? fail(e) : done()));
              (server as { closeAllConnections?: () => void }).closeAllConnections?.();
            }),
        });
      },
    );
    server.once("error", reject);
  });
}
