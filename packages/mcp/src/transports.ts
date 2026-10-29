// The MCP server's two transports (card E8.4): stdio, which Claude Code and
// Codex launch as a child process, and streamable HTTP on a loopback port.
// The MCP specification asks a local streamable HTTP server to validate
// `Origin` and bind to localhost; it runs behind the HTTP API's own loopback
// guard (Host a loopback name with the port, a present Origin the server's
// own, bodies application/json; ADR 0027 decision 4), and refuses any host
// that is not loopback before binding.
import type { AddressInfo } from "node:net";
import type { Readable, Writable } from "node:stream";
import { isLoopbackHost, LOOPBACK_HOSTS, loopbackGuard, UsageError } from "@engram/server";
import { serve } from "@hono/node-server";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";

/** The path the streamable HTTP endpoint answers on. */
export const MCP_PATH = "/mcp";

/** Serves `server` over stdio until the client closes the stream or `stop` is aborted. */
export async function serveStdio(
  server: Server,
  stdin: Readable,
  stdout: Writable,
  stop?: AbortSignal,
): Promise<void> {
  const transport = new StdioServerTransport(stdin, stdout);
  const closed = new Promise<void>((done) => {
    transport.onclose = () => done();
    stdin.once("end", () => done());
    stop?.addEventListener("abort", () => done(), { once: true });
  });
  await server.connect(transport);
  await closed;
  await server.close();
}

/**
 * A Hono app with the streamable HTTP endpoint at MCP_PATH behind the
 * loopback guard. Stateless: each request gets its own server and transport,
 * as the SDK's stateless example does, and answers with JSON, not a stream.
 */
export function mcpHttpApp(makeServer: () => Server, port: number): Hono {
  const app = new Hono();
  app.use("*", loopbackGuard(port));
  app.all(MCP_PATH, async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
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
