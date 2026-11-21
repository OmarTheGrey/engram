// `engram serve` puts the app on a port (ADR 0027 decision 4, ADR 0042
// decisions 5 and 7). A served app must either accept credentials (an API
// key file, a token issuer, or both) or carry the waiver
// `insecure-loopback`, under which the body's actor is believed as before;
// no server starts with neither. The waiver serves loopback only. A host
// that is not loopback is accepted only with credentials and an https
// resource URL: Engram serves plain HTTP and expects a TLS proxy in front.
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { type AppAuth, type AppOptions, createApp, DEFAULT_PORT } from "./app.ts";
import type { Credentials } from "./auth.ts";
import { builtUi } from "./static.ts";
import { UsageError, type Workspace } from "./workspace.ts";

/** The hosts that are loopback; the only ones the waiver serves. */
export const LOOPBACK_HOSTS = ["127.0.0.1", "::1", "localhost"] as const;

export const isLoopbackHost = (host: string) =>
  (LOOPBACK_HOSTS as readonly string[]).includes(host.toLowerCase());

/**
 * Whether an address a socket is bound to is loopback: 127.0.0.0/8, ::1, or
 * 127.0.0.0/8 mapped into IPv6. Checked after binding (review finding R3-11),
 * since `localhost` is resolved by the system and could name another address.
 */
export const isLoopbackAddress = (address: string) =>
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(address) ||
  address === "::1" ||
  /^::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/i.test(address);

/** The UsageError for a socket bound to an address that is not loopback. */
export const notLoopbackBound = (address: string) =>
  new UsageError(
    `the server was bound to ${address}, which is not a loopback address; it was closed (ADR 0027)`,
  );

/** How a served surface authenticates: credentials, or the waiver by name. */
export type ServeAuth =
  | { insecureLoopback: true }
  | { insecureLoopback?: false; credentials: Credentials; resource?: string };

/**
 * Why a bind may not happen, or undefined (ADR 0042 decisions 5 and 7). One
 * rule for listen, the MCP transport and `engram doctor`.
 */
export function bindRefusal(bind: {
  host: string;
  insecureLoopback: boolean;
  credentials: boolean;
  resource?: string | undefined;
}): string | undefined {
  if (bind.insecureLoopback && bind.credentials)
    return "--insecure-loopback and a credential flag (--keys, --issuer) exclude each other";
  if (!bind.insecureLoopback && !bind.credentials)
    return "the server needs authentication: give --keys <file> or --issuer with --jwks and --subjects, or --insecure-loopback to serve loopback with self-asserted actors (ADR 0042)";
  if (bind.resource !== undefined) {
    let url: URL;
    try {
      url = new URL(bind.resource);
    } catch {
      return `--resource ${bind.resource} is not a URL`;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:")
      return `--resource ${bind.resource} is not an http or https URL`;
    if (url.search !== "" || url.hash !== "")
      return `--resource ${bind.resource} carries a query or fragment`;
  }
  if (isLoopbackHost(bind.host)) return undefined;
  if (bind.insecureLoopback)
    return `--host ${bind.host} is not a loopback address; --insecure-loopback serves ${LOOPBACK_HOSTS.join(", ")} only (ADR 0042)`;
  if (bind.resource === undefined || !bind.resource.toLowerCase().startsWith("https://"))
    return `--host ${bind.host} is not a loopback address; beyond loopback the server needs an https --resource, the public URL of the TLS proxy in front of it (ADR 0042)`;
  return undefined;
}

/** The base URL a host and port are reached at. */
export const baseUrl = (host: string, port: number) =>
  `http://${host.includes(":") ? `[${host}]` : host}:${port}`;

/** The app's auth for a ServeAuth once its port is known; the resource defaults to `fallback`. */
export function appAuth(auth: ServeAuth, fallback: string, surface: "http" | "mcp_http"): AppAuth {
  if (auth.insecureLoopback === true) return { mode: "insecure-loopback", surface };
  return {
    mode: "credentials",
    credentials: auth.credentials,
    resource: auth.resource ?? fallback,
    surface,
  };
}

export interface ListenOptions extends Omit<AppOptions, "port" | "auth"> {
  /** Default 127.0.0.1. */
  host?: string;
  /** Default DEFAULT_PORT; 0 picks a free port. */
  port?: number;
  /** Credentials or the waiver; required, so no caller serves without choosing (ADR 0042). */
  auth: ServeAuth;
}

export interface Listening {
  /** The base URL clients use, such as http://127.0.0.1:7313. */
  url: string;
  port: number;
  /** The resource URL of an authenticated server; undefined under the waiver. */
  resource: string | undefined;
  close(): Promise<void>;
}

/** Serves the workspace; a bind bindRefusal refuses is a UsageError before anything is bound. */
export function listen(workspace: Workspace, options: ListenOptions): Promise<Listening> {
  const host = options.host ?? "127.0.0.1";
  const credentials = options.auth.insecureLoopback !== true;
  const refusal = bindRefusal({
    host,
    insecureLoopback: !credentials,
    credentials,
    resource: options.auth.insecureLoopback === true ? undefined : options.auth.resource,
  });
  if (refusal !== undefined) throw new UsageError(refusal);
  const requested = options.port ?? DEFAULT_PORT;
  if (!Number.isInteger(requested) || requested < 0 || requested > 65_535)
    throw new UsageError(`--port ${requested} is not a port number`);
  return new Promise((resolveListening, reject) => {
    let app: ReturnType<typeof createApp> | undefined;
    const server = serve(
      {
        fetch: (request: Request) =>
          app ? app.fetch(request) : new Response("starting", { status: 503 }),
        hostname: host,
        port: requested,
      },
      (info: AddressInfo) => {
        if (isLoopbackHost(host) && !isLoopbackAddress(info.address)) {
          server.close();
          reject(notLoopbackBound(info.address));
          return;
        }
        // The inspector `make ui` built, unless the caller names one or null.
        const ui = options.ui === undefined ? builtUi() : options.ui;
        const url = baseUrl(isLoopbackHost(host) ? host : "127.0.0.1", info.port);
        const auth = appAuth(options.auth, url, "http");
        const { auth: _auth, host: _host, port: _port, ...rest } = options;
        app = createApp(workspace, { ...rest, ui, port: info.port, auth });
        resolveListening({
          url,
          port: info.port,
          resource: auth.mode === "credentials" ? auth.resource : undefined,
          close: () =>
            new Promise((done, fail) => {
              server.close((e) => (e ? fail(e) : done()));
              // Keep-alive connections would hold close open until they time out.
              (server as { closeAllConnections?: () => void }).closeAllConnections?.();
            }),
        });
      },
    );
    server.once("error", reject);
  });
}
