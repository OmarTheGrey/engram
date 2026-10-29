// The HTTP server (card E8.1, ADR 0027): a Hono app serving the route table
// over one workspace. The app is a fetch function (`app.fetch`), so the CLI
// and the MCP server call it in process through the generated client with no
// socket at all, and `engram serve` puts the same function on a loopback port
// (listen.ts).
//
// No authentication exists in v0, so a request is refused before any route
// runs (ADR 0027 decision 4), each rule with a test that fails without it:
//   - Host: a loopback name with the server's port (127.0.0.1, localhost,
//     [::1]), so a page whose DNS name was rebound to 127.0.0.1 is refused;
//   - Origin: when present, the server's own origin and nothing else (a
//     browser sends it on every cross-origin request and on same-origin POST);
//   - Content-Type: a request with a body must say application/json, which a
//     cross-site page cannot send without a preflight, and the preflight gets
//     no CORS headers, so it fails;
//   - no CORS header is ever sent;
//   - the body is capped (MAX_BODY_BYTES).
//
// Errors (ADR 0027 decision 6): a decision is 200 with its event; a request
// that fails its schema is 400, InvalidCallError 400, ExplainDeniedError 403,
// UnknownReadError 404, NotImplementedYet 501 naming the card, NoStoreError
// 503; anything else is 500 with no internals in the body, handed to
// `onError` (the server's own log, or the CLI's stderr in process).
import {
  ExplainDeniedError,
  InvalidCallError,
  NotImplementedYet,
  UnknownReadError,
} from "@engram/core";
import { Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { z } from "zod";
import type { ErrorResponse } from "./contract.ts";
import { API_PREFIX, ROUTES, type Route } from "./routes.ts";
import { NoStoreError, type Workspace } from "./workspace.ts";

/** The largest request body accepted, in bytes. */
export const MAX_BODY_BYTES = 1024 * 1024;
/** The port `engram serve` listens on unless --port names another. */
export const DEFAULT_PORT = 7313;
/** The names a loopback Host header may carry. */
export const LOOPBACK_NAMES = ["127.0.0.1", "localhost", "[::1]"] as const;

export interface AppOptions {
  /** The port the server is reached on; the Host and Origin rules name it. */
  port: number;
  /** The time a call without `at` is made at (ISO 8601 UTC). */
  now: () => string;
  /** Where a 500's error goes; the response never carries it. */
  onError?: (error: unknown) => void;
}

type ErrorBody = z.infer<typeof ErrorResponse>;
type Code = ErrorBody["error"]["code"];

const failure = (status: number, code: Code, message: string, card?: string) =>
  Response.json(
    { error: card === undefined ? { code, message } : { code, message, card } },
    { status },
  );

/** The Host values the app answers: each loopback name with its port. */
export function allowedHosts(port: number): string[] {
  return LOOPBACK_NAMES.map((name) => `${name}:${port}`);
}

/** The status and body an error thrown by a handler maps to. */
function mapError(e: unknown, onError: AppOptions["onError"]): Response {
  if (e instanceof InvalidCallError) return failure(400, "invalid_call", e.message);
  if (e instanceof ExplainDeniedError) return failure(403, "explain_denied", e.message);
  if (e instanceof UnknownReadError) return failure(404, "not_found", e.message);
  if (e instanceof NotImplementedYet)
    return failure(501, "not_implemented", `not implemented yet (card ${e.card})`, e.card);
  if (e instanceof NoStoreError) return failure(503, "no_store", e.message);
  onError?.(e);
  return failure(500, "internal", "internal error");
}

/** The media type of a Content-Type header, lower case, without parameters. */
const mediaType = (header: string | undefined) => header?.split(";")[0]?.trim().toLowerCase() ?? "";

/** Hono's path syntax for an OpenAPI path: `{readId}` becomes `:readId`. */
export const honoPath = (path: string) => `${API_PREFIX}${path.replace(/\{(\w+)\}/g, ":$1")}`;

/** Methods whose body a browser could send cross-site without a preflight. */
const WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

/**
 * The loopback rules of ADR 0027 decision 4 as one middleware: the Host is a
 * loopback name with `port`, a present Origin is the server's own, and a
 * request with a body says application/json. The MCP server's streamable
 * HTTP transport (packages/mcp) runs behind the same middleware.
 */
export function loopbackGuard(port: number): MiddlewareHandler {
  const hosts = new Set(allowedHosts(port));
  const origins = new Set([...hosts].map((h) => `http://${h}`));
  return async (c, next) => {
    // Under @hono/node-server the URL is built from the Host header; in
    // process it is the client's base URL. Either way both must be loopback.
    const header = c.req.header("host");
    const host = (header ?? new URL(c.req.url).host).toLowerCase();
    if (!hosts.has(host) || !hosts.has(new URL(c.req.url).host.toLowerCase()))
      return failure(403, "forbidden_host", "the Host header must name this loopback server");
    const origin = c.req.header("origin");
    if (origin !== undefined && !origins.has(origin.toLowerCase()))
      return failure(403, "forbidden_origin", "cross-origin requests are refused");
    if (
      WITH_BODY.has(c.req.method) &&
      mediaType(c.req.header("content-type")) !== "application/json"
    )
      return failure(415, "unsupported_media_type", "request bodies must be application/json");
    await next();
  };
}

export function createApp(workspace: Workspace, options: AppOptions): Hono {
  const app = new Hono();
  app.use("*", loopbackGuard(options.port));
  app.use(
    "*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: () =>
        failure(413, "payload_too_large", `request bodies are limited to ${MAX_BODY_BYTES} bytes`),
    }),
  );

  for (const r of ROUTES) register(app, r, workspace, options);

  app.notFound(() => failure(404, "not_found", "no such route"));
  app.onError((e) => mapError(e, options.onError));
  return app;
}

function register(app: Hono, r: Route, workspace: Workspace, options: AppOptions): void {
  app.on(r.method.toUpperCase(), honoPath(r.path), async (c) => {
    let body: unknown;
    if (r.request !== undefined) {
      let raw: unknown;
      try {
        raw = await c.req.json();
      } catch {
        return failure(400, "bad_request", "the body is not JSON");
      }
      const parsed = r.request.safeParse(raw);
      if (!parsed.success)
        return failure(
          400,
          "bad_request",
          parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "),
        );
      body = parsed.data;
    }
    try {
      const result = await r.handler({
        workspace,
        body,
        params: c.req.param() as Record<string, string>,
        now: options.now,
      });
      return c.json(result as object, 200);
    } catch (e) {
      return mapError(e, options.onError);
    }
  });
}
