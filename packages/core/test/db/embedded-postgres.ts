// A throwaway Postgres server for tests (no Docker; the lead's instruction of
// 2026-10-29, ADR 0024 amendment): embedded-postgres runs the real Postgres 17
// binaries for this platform on a free port, in a fresh temporary data
// directory that stop() deletes. Used by the core test projects' globalSetup
// (global-setup.ts) and reusable by any other package's tests.
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

// embedded-postgres registers async-exit-hook when it is imported. The hook's
// `beforeExit` (and `exit`, `message`) listeners call process.exit(0) on the
// next tick, which overwrote vitest's exit code 1: from PR 2 until this fix a
// failing core or cli test exited 0 (docs/log/2026-10-29-exit-code-0-on-failing-tests.md).
// Our setup stops the server itself in its teardown, so those listeners are
// removed. The signal listeners (SIGINT, SIGTERM, SIGHUP, SIGBREAK) stay: they
// stop the server when a run is interrupted and exit 128 plus the signal,
// never 0.
const NEVER_EXIT_ZERO = ["beforeExit", "exit", "message"] as const;

type EmbeddedPostgresClass = typeof import("embedded-postgres").default;
let loaded: Promise<EmbeddedPostgresClass> | undefined;

/** Imports embedded-postgres once, without the exit hooks that would hide a failing run. */
export function loadEmbeddedPostgres(): Promise<EmbeddedPostgresClass> {
  const emitter: NodeJS.EventEmitter = process;
  loaded ??= (async () => {
    const before = new Map(NEVER_EXIT_ZERO.map((e) => [e, new Set(emitter.listeners(e))]));
    const { default: EmbeddedPostgres } = await import("embedded-postgres");
    for (const event of NEVER_EXIT_ZERO) {
      for (const listener of emitter.listeners(event)) {
        if (!before.get(event)?.has(listener)) {
          emitter.removeListener(event, listener as (...args: unknown[]) => void);
        }
      }
    }
    return EmbeddedPostgres;
  })();
  return loaded;
}

export interface EmbeddedPostgresServer {
  /** postgres://engram:engram@127.0.0.1:<port>/postgres */
  url: string;
  /** Stops the server and deletes its data directory. */
  stop(): Promise<void>;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Initialises and starts a server. Rejects, with Postgres's own output in the
 * message, when the binaries cannot run here (no binary for the platform, or
 * initdb refusing to run as root or as an administrator).
 */
export async function startEmbeddedPostgres(): Promise<EmbeddedPostgresServer> {
  const root = mkdtempSync(join(tmpdir(), "engram-pg-"));
  const port = await freePort();
  const output: string[] = [];
  const EmbeddedPostgres = await loadEmbeddedPostgres();
  const pg = new EmbeddedPostgres({
    databaseDir: join(root, "data"),
    port,
    user: "engram",
    password: "engram",
    persistent: false,
    // Test files run in parallel, each with its own connections.
    postgresFlags: ["-c", "max_connections=200"],
    onLog: () => {},
    onError: (e) => output.push(String(e)),
  });
  try {
    await pg.initialise();
    await pg.start();
  } catch (e) {
    await pg.stop().catch(() => {});
    rmSync(root, { recursive: true, force: true });
    const detail = output.join(" ").trim();
    throw new Error(`embedded Postgres did not start: ${String(e)}${detail ? `; ${detail}` : ""}`);
  }
  return {
    url: `postgres://engram:engram@127.0.0.1:${port}/postgres`,
    async stop() {
      await pg.stop();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
