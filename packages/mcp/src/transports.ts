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
// though their writes had committed).
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    await new Promise<void>((done) => {
      drained = done;
      timer = setTimeout(done, STDIO_DRAIN_MS);
      stop?.addEventListener("abort", () => done(), { once: true });
    });
    clearTimeout(timer);
  }
  await server.close();
}

/** How many MCP sessions the HTTP transport keeps; the oldest is closed past it. */
export const MAX_HTTP_SESSIONS = 64;

/**
 * A Hono app with the streamable HTTP endpoint at MCP_PATH behind the
 * loopback guard. One server and transport per MCP session (the SDK's
 * stateful pattern): an initialize request with no `mcp-session-id` starts
 * one, later requests name it, and a DELETE or MAX_HTTP_SESSIONS newer
 * sessions end it. A server holds its session's own calls, so memory_simulate
 * replays that session's workload (card RV5, RV-SRF-6). Answers are JSON,
 * not a stream. Session ids are random UUIDs; they identify a session, they
 * do not authenticate it (loopback only, ADR 0027 decision 4).
 */
export function mcpHttpApp(makeServer: () => Server, port: number): Hono {
  const app = new Hono();
  const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();
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
    const id = c.req.header("mcp-session-id");
    if (id !== undefined) {
      const known = sessions.get(id);
      if (known === undefined)
        return Response.json(
          { jsonrpc: "2.0", error: { code: -32001, message: "Session not found" }, id: null },
          { status: 404 },
        );
      return known.handleRequest(c.req.raw);
    }
    // No session named: the transport answers an initialize request with a
    // new session id and refuses anything else, and only an initialized
    // session is kept.
    const transport: WebStandardStreamableHTTPServerTransport =
      new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (sid) => {
          sessions.set(sid, transport);
          for (const [old, t] of sessions) {
            if (sessions.size <= MAX_HTTP_SESSIONS) break;
            sessions.delete(old);
            void t.close();
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
  options: { host?: string; port: number },
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
        app = mcpHttpApp(makeServer, info.port);
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
