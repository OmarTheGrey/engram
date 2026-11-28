// The offline guard (card E0.7): under ENGRAM_OFFLINE=1, which CI sets, a test
// that reaches the network fails at once with a message saying so, instead
// of hanging or passing only on a machine that is online (cards L7 and X14
// each met tests that broke only under the variable). vitest.shared.ts lists
// offline-guard.setup.ts as a setup file of every project, so the guard is in
// place before any test file is loaded.
//
// What it refuses: `fetch`, every TCP or TLS connection (http, https, undici,
// WebSocket and most clients go through net.Socket's connect), a connection
// given its own `lookup` function, and every DNS query (the node:dns and
// node:dns/promises functions and their Resolver classes), as the adapters'
// conformance guard does (packages/adapters/test/conformance/network-guard.ts,
// whose shape this follows). Unlike that guard it lets the loopback through:
// the embedded Postgres, the HTTP server and the MCP server are tested over
// 127.0.0.1, and a loopback connection leaves the machine for nowhere. The
// loopback is the name `localhost` itself (a name under `.localhost` may be
// sent to a resolver), 127.0.0.0/8 and ::1. A lookup of an IP literal makes
// no query and passes, so a server may bind 0.0.0.0; the connect check still
// guards the address. A Unix socket or local named pipe (a `path`) is local;
// a Windows UNC path to a host (`\\host\pipe\x`) is not.
//
// A refusal is a synchronous throw where the call is synchronous, and a
// rejected promise from fetch and dns/promises. A client that connects inside
// its own machinery (a WebSocket, a fetch redirect) sees the throw as an
// asynchronous error event. Outside it: a child process (a spawned `git` or
// `uv`), a worker thread (it loads its own copy of node:net and node:dns, and
// no setup file), dgram, and pytest.
//
// Ideas from Compartment's offline_guard.py (Apache-2.0,
// MaxFreedomPollard/Compartment at 98d4917181c0) and Scuttie's hidden-call
// audit (Apache-2.0, Scuttie/enterprise-shared-memory-poc); no code copied.
import dns from "node:dns";
import net from "node:net";

const REFUSED = "ENGRAM_OFFLINE=1: network access refused in a test";
const HINT =
  "a test reaches no network (docs/conventions/testing.md); one that fetches pinned data declares it with allowPinnedDataFetch";

/** The test files that fetch pinned upstream data and say so with `allowPinnedDataFetch`. */
export const PINNED_DATA_FETCH_TESTS: readonly string[] = [];

export interface OfflineGuard {
  /** One line per refused attempt, in order. */
  readonly attempts: string[];
  /** Puts back the functions the guard replaced. */
  restore(): void;
}

/** True for a host that names this machine: localhost, 127.0.0.0/8 and ::1, in any of their spellings. */
export function isLoopback(host: string | undefined | null): boolean {
  if (host === undefined || host === null || host === "") return true; // net's default host is localhost
  const h = host.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (h === "localhost") return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return h === "::1" || h === "0:0:0:0:0:0:0:1";
}

/** Where a fetch input goes, or undefined when it reaches no network (data:, blob:, file:). */
function fetchHost(input: unknown): { host: string; url: string } | undefined {
  const raw =
    input instanceof Request ? input.url : input instanceof URL ? input.href : String(input);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { host: raw, url: raw }; // a relative or malformed URL: refused, named as given
  }
  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:" &&
    url.protocol !== "ws:" &&
    url.protocol !== "wss:"
  )
    return undefined;
  return { host: url.hostname, url: url.href };
}

/**
 * A Windows UNC path naming a host (two slashes, then anything but the local
 * device prefixes `.` and `?`), which reaches that host over SMB.
 */
export function isRemotePipe(path: string, platform: string = process.platform): boolean {
  return platform === "win32" && /^[\\/]{2}(?![.?][\\/])/.test(path);
}

/** The target of a net.Socket#connect call: a host and port, or a local path, and its own lookup. */
function connectTarget(args: unknown[]): {
  host?: string;
  path?: string;
  port?: unknown;
  lookup?: boolean;
} {
  // net.connect normalises its arguments into an array it passes as the first one.
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (typeof first === "string" && Number.isNaN(Number(first))) return { path: first };
  if (typeof first === "number" || typeof first === "string") {
    const second = Array.isArray(args[0]) ? args[0][1] : args[1];
    return { port: first, host: typeof second === "string" ? second : undefined };
  }
  if (first !== null && typeof first === "object") {
    const o = first as { host?: unknown; path?: unknown; port?: unknown; lookup?: unknown };
    if (typeof o.path === "string") return { path: o.path };
    return {
      host: typeof o.host === "string" ? o.host : undefined,
      port: o.port,
      lookup: typeof o.lookup === "function",
    };
  }
  return {};
}

type Lookup = (host: string, ...rest: unknown[]) => unknown;

/**
 * Replaces fetch, net.Socket#connect and DNS resolution with versions that refuse
 * any host but the loopback, throwing at once. Layered: it wraps whatever is in
 * place now, and `restore` puts that back.
 */
export function createOfflineGuard(): OfflineGuard {
  const attempts: string[] = [];
  const refuse = (what: string): never => {
    attempts.push(what);
    throw new Error(`${REFUSED} (${what}); ${HINT}`);
  };

  const realFetch = globalThis.fetch;
  const realConnect = net.Socket.prototype.connect;
  const replaced: Array<[Record<string, unknown>, string, unknown]> = [];
  const replace = (target: object, key: string, value: unknown) => {
    const t = target as Record<string, unknown>;
    replaced.push([t, key, t[key]]);
    t[key] = value;
  };

  replace(globalThis, "fetch", (input: unknown, init?: RequestInit) => {
    const to = fetchHost(input);
    if (to !== undefined && !isLoopback(to.host))
      return Promise.reject(refuseError(`fetch ${to.url}`));
    return realFetch(input as Parameters<typeof fetch>[0], init);
  });
  // A rejected promise, not a throw, as fetch itself reports failure; the attempt is recorded either way.
  function refuseError(what: string): Error {
    try {
      return refuse(what);
    } catch (e) {
      return e as Error;
    }
  }

  net.Socket.prototype.connect = function connect(this: net.Socket, ...args: unknown[]) {
    const to = connectTarget(args);
    if (to.path !== undefined) {
      if (isRemotePipe(to.path)) refuse(`socket connect ${to.path}`);
    } else if (to.lookup) {
      // Its own lookup decides where the socket goes, whatever host it names.
      refuse(`socket connect ${to.host ?? "localhost"}:${String(to.port)} with its own lookup`);
    } else if (!isLoopback(to.host)) refuse(`socket connect ${to.host}:${String(to.port)}`);
    return (realConnect as (...a: unknown[]) => net.Socket).apply(this, args);
  } as typeof net.Socket.prototype.connect;

  // Every resolver function of node:dns and node:dns/promises, and of their
  // Resolver classes, takes the host name (or, for reverse and lookupService, the address) first.
  const resolvers = (target: object) =>
    Object.getOwnPropertyNames(target).filter(
      (k) =>
        (k === "lookup" || k === "lookupService" || k.startsWith("resolve") || k === "reverse") &&
        typeof Object.getOwnPropertyDescriptor(target, k)?.value === "function",
    );
  const targets: Array<[object, boolean]> = [
    [dns, false],
    [dns.promises, true],
    [dns.Resolver.prototype, false],
    [dns.promises.Resolver.prototype, true],
  ];
  for (const [target, isPromise] of targets) {
    for (const key of resolvers(target)) {
      const real = (target as Record<string, Lookup>)[key] as Lookup;
      replace(target, key, function guarded(this: unknown, host: string, ...rest: unknown[]) {
        // getaddrinfo on an IP literal returns it without a query.
        const literal = key === "lookup" && typeof host === "string" && net.isIP(host) !== 0;
        if (!literal && !isLoopback(host)) {
          if (isPromise) return Promise.reject(refuseError(`dns ${key} ${host}`));
          refuse(`dns ${key} ${host}`);
        }
        return real.call(this, host, ...rest);
      });
    }
  }

  return {
    attempts,
    restore() {
      net.Socket.prototype.connect = realConnect;
      for (const [target, key, value] of replaced.reverse()) target[key] = value;
      replaced.length = 0;
    },
  };
}

const INSTALLED = Symbol.for("engram.offlineGuard");
type Holder = { [INSTALLED]?: OfflineGuard };

/** The guard the setup file installed in this worker, if ENGRAM_OFFLINE=1 was set. */
export function runGuard(): OfflineGuard | undefined {
  return (globalThis as Holder)[INSTALLED];
}

/**
 * The setup file's entry: installs the guard once per worker when
 * ENGRAM_OFFLINE=1. Read once, at setup: a test that clears the variable for
 * its own call (`withOffline`) does not lift the guard.
 */
export function installForRun(env: NodeJS.ProcessEnv = process.env): OfflineGuard | undefined {
  if (env.ENGRAM_OFFLINE !== "1") return undefined;
  const holder = globalThis as Holder;
  holder[INSTALLED] ??= createOfflineGuard();
  return holder[INSTALLED];
}

/**
 * Lifts the run's guard for a test that fetches pinned upstream data at its
 * pinned commit (data only, never a model), until the returned function is
 * called. `what` names the data. The calling file must be listed in
 * PINNED_DATA_FETCH_TESTS and in docs/conventions/testing.md; the offline
 * guard's test fails on a caller that is not.
 */
export function allowPinnedDataFetch(what: string): () => void {
  if (what.trim() === "") throw new Error("allowPinnedDataFetch: name the pinned data fetched");
  const holder = globalThis as Holder;
  const guard = holder[INSTALLED];
  if (guard === undefined) return () => {};
  guard.restore();
  delete holder[INSTALLED];
  return () => {
    holder[INSTALLED] ??= createOfflineGuard();
  };
}
