// The HTTP server (card E8.1, ADR 0027): a Hono app serving the route table
// over one workspace. The app is a fetch function (`app.fetch`), so the CLI
// and the MCP server call it in process through the generated client with no
// socket at all, and `engram serve` puts the same function on a loopback port
// (listen.ts).
//
// Authentication (card E8.12, ADR 0042): a served app (listen.ts) carries
// `auth`. With credentials, every API request but GET /health needs a
// bearer API key or token (auth.ts); the request's actor is bound to the
// credential's, its sent source ignored, and each event it appends is
// attested (attest.ts). Under `insecure-loopback` the body's actor is taken
// as given, as before, and its events are attested as waived. With no
// `auth` the app is the in-process client's (ADR 0027 decision 3): no
// credential, no attestation.
//
// Whatever the auth, a request is refused before any route runs when it
// breaks a rule of ADR 0027 decision 4, each with a test that fails without it:
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
import { type Attestation, attested, type Surface } from "./attest.ts";
import {
  authenticate,
  bindActor,
  type Credentials,
  metadataPath,
  type Principal,
  protectedResourceMetadata,
  wwwAuthenticate,
} from "./auth.ts";
import type { ErrorResponse } from "./contract.ts";
import type { DecisionExport } from "./export.ts";
import { API_PREFIX, ROUTES, type Route } from "./routes.ts";
import { isApiPath, uiResponse } from "./static.ts";
import { NoStoreError, type Workspace } from "./workspace.ts";

/** The largest request body accepted, in bytes. */
export const MAX_BODY_BYTES = 1024 * 1024;
/** The port `engram serve` listens on unless --port names another. */
export const DEFAULT_PORT = 7313;
/** The names a loopback Host header may carry. */
export const LOOPBACK_NAMES = ["127.0.0.1", "localhost", "[::1]"] as const;

/**
 * How a served app authenticates (ADR 0042 decision 5): credentials and the
 * server's resource URL (its audience unless the issuer setup names one, and
 * the subject of its protected-resource metadata), or the waiver.
 */
export type AppAuth =
  | { mode: "insecure-loopback"; surface?: Surface }
  | { mode: "credentials"; credentials: Credentials; resource: string; surface?: Surface };

/** The public origin a resource URL adds to the Host and Origin guards, if any (decision 7). */
export function publicOriginOf(auth: AppAuth | undefined): string | undefined {
  if (auth?.mode !== "credentials") return undefined;
  const url = new URL(auth.resource);
  const loopback = (LOOPBACK_NAMES as readonly string[]).includes(url.hostname.toLowerCase());
  return loopback ? undefined : url.origin;
}

export interface AppOptions {
  /** The port the server is reached on; the Host and Origin rules name it. */
  port: number;
  /** The time a call without `at` is made at (ISO 8601 UTC). */
  now: () => string;
  /** Where a 500's error goes; the response never carries it. */
  onError?: (error: unknown) => void;
  /**
   * The built inspector's directory (packages/ui/dist, card E8.5), served at
   * / beside the API; none when null or absent (static.ts).
   */
  ui?: string | null;
  /**
   * The decision export (card E8.13, ADR 0043): flushed after every API
   * call, so each event the call appended leaves as a span; none when absent,
   * the default. A failed flush goes to `onError` and never fails the call.
   */
  decisions?: DecisionExport;
  /** How a served app authenticates; absent for the in-process client (ADR 0027 decision 3). */
  auth?: AppAuth;
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
export function loopbackGuard(port: number, publicOrigin?: string): MiddlewareHandler {
  const hosts = new Set(allowedHosts(port));
  const origins = new Set([...hosts].map((h) => `http://${h}`));
  // An authenticated server behind a TLS proxy is also reached by its
  // resource URL's public name (ADR 0042 decision 7).
  if (publicOrigin !== undefined) {
    hosts.add(new URL(publicOrigin).host.toLowerCase());
    origins.add(publicOrigin.toLowerCase());
  }
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

/** The principal each authenticated request was bound to, by its Request. */
export type Principals = WeakMap<Request, Principal>;

/**
 * The credential check of ADR 0042 decision 5 as one middleware: a path
 * `needsCredential` names needs a bearer credential the server accepts; a
 * 401 names the protected-resource metadata. The MCP server's HTTP
 * transport runs behind the same middleware.
 */
export function credentialGuard(
  credentials: Credentials,
  resource: string,
  now: () => string,
  principals: Principals,
  needsCredential: (pathname: string, method: string) => boolean,
): MiddlewareHandler {
  return async (c, next) => {
    const { pathname } = new URL(c.req.url);
    if (!needsCredential(pathname, c.req.method)) return next();
    const outcome = await authenticate(credentials, c.req.header("authorization"), {
      now: now(),
      audience: resource,
    });
    if (!outcome.ok) {
      const response = failure(
        outcome.status,
        outcome.status === 401 ? "unauthorized" : "forbidden_actor",
        outcome.message,
      );
      if (outcome.status === 401)
        response.headers.set("www-authenticate", wwwAuthenticate(resource, outcome.invalidToken));
      return response;
    }
    principals.set(c.req.raw, outcome.principal);
    await next();
  };
}

/** Serves the protected-resource metadata (RFC 9728) at its well-known paths. */
export function serveMetadata(app: Hono, credentials: Credentials, resource: string): void {
  const document = protectedResourceMetadata(resource, credentials);
  const paths = new Set([metadataPath(resource), "/.well-known/oauth-protected-resource"]);
  for (const path of paths) app.get(path, () => Response.json(document));
}

const HEALTH = `${API_PREFIX}/health`;

export function createApp(workspace: Workspace, options: AppOptions): Hono {
  const app = new Hono();
  const auth = options.auth;
  app.use("*", loopbackGuard(options.port, publicOriginOf(auth)));
  app.use(
    "*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: () =>
        failure(413, "payload_too_large", `request bodies are limited to ${MAX_BODY_BYTES} bytes`),
    }),
  );
  const principals: Principals = new WeakMap();
  if (auth?.mode === "credentials") {
    serveMetadata(app, auth.credentials, auth.resource);
    app.use(
      "*",
      credentialGuard(
        auth.credentials,
        auth.resource,
        options.now,
        principals,
        // Every API path but the health check; the inspector's files are public.
        (pathname, method) => isApiPath(pathname) && !(pathname === HEALTH && method === "GET"),
      ),
    );
  }

  for (const r of ROUTES) register(app, r, workspace, options, principals);

  // The inspector's files, after the guards above and outside the API's
  // space: any path whose first segment is `api`, however spelled, gets the
  // API's JSON 404, never the page (isApiPath).
  const ui = options.ui ?? null;
  app.on(["GET", "HEAD"], "*", (c, next) => {
    const { pathname } = new URL(c.req.url);
    if (isApiPath(pathname)) return next();
    if (ui === null)
      return pathname === "/"
        ? failure(404, "not_found", "the inspector is not built; run make ui")
        : next();
    return uiResponse(ui, pathname, c.req.method === "HEAD") ?? next();
  });

  app.notFound(() => failure(404, "not_found", "no such route"));
  app.onError((e) => mapError(e, options.onError));
  return app;
}

/** The actor a parsed body names, if it has one. */
const bodyActor = (body: unknown) =>
  (body as { actor?: Parameters<typeof bindActor>[1] } | undefined)?.actor;

function register(
  app: Hono,
  r: Route,
  workspace: Workspace,
  options: AppOptions,
  principals: Principals,
): void {
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
    // ADR 0042 decisions 3 and 4: an authenticated request acts as its
    // credential's actor, narrowed to the memberships it names; another id,
    // level or membership is refused before the Plane is called, and the
    // source it sent is replaced by the credential's.
    const principal = principals.get(c.req.raw);
    // Fail closed (review finding E8.12-3): on a server with credentials a
    // route the guard did not authenticate never runs, however it was reached.
    if (options.auth?.mode === "credentials" && principal === undefined && r.id !== "health")
      return failure(401, "unauthorized", "this server needs a bearer credential (ADR 0042)");
    const claimed = bodyActor(body);
    if (principal !== undefined && claimed !== undefined) {
      const bound = bindActor(principal.actor, claimed);
      if (!bound.ok) return failure(403, "forbidden_actor", bound.message);
      body = { ...(body as object), actor: bound.actor };
    }
    const attestation = attestationOf(options.auth, principal, claimed?.id);
    const call = () =>
      r.handler({
        workspace,
        body,
        params: c.req.param() as Record<string, string>,
        now: options.now,
      });
    try {
      const result = await (attestation === undefined ? call() : attested(attestation, call));
      return c.json(result as object, 200);
    } catch (e) {
      return mapError(e, options.onError);
    } finally {
      try {
        options.decisions?.flush();
      } catch (e) {
        options.onError?.(e);
      }
    }
  });
}

/**
 * What the side table records for a served request's events (ADR 0042
 * decision 8): the credential, or the waiver and the id the body asserted;
 * nothing in process.
 */
function attestationOf(
  auth: AppAuth | undefined,
  principal: Principal | undefined,
  claimedId: string | undefined,
): Attestation | undefined {
  if (auth === undefined) return undefined;
  const surface = auth.surface ?? "http";
  if (principal !== undefined)
    return {
      surface,
      method: principal.method,
      actor: principal.actor.id,
      issuer: principal.issuer,
      subject: principal.subject,
    };
  if (auth.mode !== "insecure-loopback") return undefined;
  return {
    surface,
    method: "insecure_loopback",
    actor: claimedId ?? "unattributed",
    issuer: null,
    subject: null,
  };
}
