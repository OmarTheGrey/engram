// `engram serve` puts the app on a loopback port (ADR 0027 decision 4). With
// no authentication, any other host would let every device on the network
// read and write as anyone, so a host that is not loopback is refused before
// anything is bound.
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { type AppOptions, createApp, DEFAULT_PORT } from "./app.ts";
import { UsageError, type Workspace } from "./workspace.ts";

/** The hosts `engram serve --host` accepts: loopback only. */
export const LOOPBACK_HOSTS = ["127.0.0.1", "::1", "localhost"] as const;

export const isLoopbackHost = (host: string) =>
  (LOOPBACK_HOSTS as readonly string[]).includes(host.toLowerCase());

export interface ListenOptions extends Omit<AppOptions, "port"> {
  /** Default 127.0.0.1. */
  host?: string;
  /** Default DEFAULT_PORT; 0 picks a free port. */
  port?: number;
}

export interface Listening {
  /** The base URL clients use, such as http://127.0.0.1:7313. */
  url: string;
  port: number;
  close(): Promise<void>;
}

/** Serves the workspace on a loopback address; refuses any other host with a UsageError. */
export function listen(workspace: Workspace, options: ListenOptions): Promise<Listening> {
  const host = options.host ?? "127.0.0.1";
  if (!isLoopbackHost(host))
    throw new UsageError(
      `--host ${host} is not a loopback address; the server has no authentication yet, so it listens on ${LOOPBACK_HOSTS.join(", ")} only (ADR 0027)`,
    );
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
        app = createApp(workspace, { ...options, port: info.port });
        const name = host.includes(":") ? `[${host}]` : host;
        resolveListening({
          url: `http://${name}:${info.port}`,
          port: info.port,
          close: () => new Promise((done, fail) => server.close((e) => (e ? fail(e) : done()))),
        });
      },
    );
    server.once("error", reject);
  });
}
