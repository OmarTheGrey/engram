// How a command reaches the plane (card E8.2, ADR 0027 decision 3): through
// the generated client, one call per command. With no server named, the
// client's fetch is the app's own (createApp over the workspace the flags
// open), so no command needs a running server; `--server <url>` or
// ENGRAM_SERVER_URL sends the same call over HTTP to `engram serve`, whose
// own flags name the workspace.
import { createEngramClient, type EngramClient } from "@engram/sdk";
import {
  createApp,
  DEFAULT_PORT,
  type DecisionExport,
  exportConfig,
  exportsAnything,
  type LocalWorkspace,
  openSinks,
  openWorkspace,
  startExport,
  type WorkspaceOptions,
} from "@engram/server";
import type { Io } from "./run.ts";
import { UsageError } from "./setup.ts";

/** The variable that names a server when --server is not given. */
export const SERVER_URL_ENV = "ENGRAM_SERVER_URL";
/**
 * The variable holding the bearer credential (an API key or a token) a call
 * to a named server sends (card E8.12, ADR 0042 decision 9). An environment
 * variable, not a flag, so the credential is not in the process list.
 */
export const TOKEN_ENV = "ENGRAM_TOKEN";

/** `fetch` with the bearer credential set on every request, when one is given. */
export function withToken(fetch: Fetch, token: string | undefined): Fetch {
  if (token === undefined || token === "") return fetch;
  return (request) => {
    const headers = new Headers(request.headers);
    headers.set("authorization", `Bearer ${token}`);
    return fetch(new Request(request, { headers }));
  };
}
/** The base URL of the in-process app: a label, never a socket. */
export const IN_PROCESS_URL = `http://127.0.0.1:${DEFAULT_PORT}`;

/** The workspace flags, which only an in-process call may take: a server has its own. */
const WORKSPACE_FLAGS = ["db", "root", "store", "policy", "import-valid-from"] as const;
/** The export flags (card E8.13): a server exports its own decisions, so these too are in process only. */
const EXPORT_FLAGS = ["otlp", "export-jsonl"] as const;

/**
 * Decision exports still sending when their command returned; `run` awaits
 * them (drainExports) so an OTLP post is not cut off by the process ending.
 */
const pending = new Set<Promise<void>>();

/** Waits for every decision export a closed connection is still sending. */
export async function drainExports(): Promise<void> {
  while (pending.size > 0) await Promise.all([...pending]);
}

/** Reports a failed decision export on stderr: the call it followed is unaffected. */
const exportFailure = (io: Pick<Io, "err">) => (e: unknown) =>
  io.err(`engram: decision export failed: ${e instanceof Error ? e.message : String(e)}\n`);

export interface Connection {
  client: EngramClient;
  /** The workspace opened in process; null when a server was named. */
  workspace: LocalWorkspace | null;
  /** The server named, when there is one. */
  server: string | undefined;
  close(): void;
}

export type Fetch = (request: Request) => Promise<Response>;

/** The server a command names: --server, else ENGRAM_SERVER_URL, else none (in process). */
export const serverOf = (io: Pick<Io, "env">, flags: { server?: string | undefined }) =>
  flags.server ?? (io.env[SERVER_URL_ENV] || undefined);

/**
 * The client a command calls. `flags` are its parsed options; `workspace`
 * builds the in-process workspace's options from them. In process, the
 * workspace is opened (policy, store) here and its log by `open`, before the
 * call, so a bad flag or a log that cannot be used is reported as it always
 * was; a 500 inside the app prints its error to stderr, as a server would log it.
 */
export function connect(
  io: Io,
  flags: { server?: string; otlp?: string; "export-jsonl"?: string } & Partial<
    Record<(typeof WORKSPACE_FLAGS)[number], unknown>
  >,
  workspace: () => Omit<WorkspaceOptions, "cwd" | "home" | "env" | "newId">,
  open: ((ws: LocalWorkspace) => void) | undefined,
): Connection {
  const server = serverOf(io, flags);
  const wrap = (fetch: Fetch): Fetch => (io.transport ? io.transport(fetch) : fetch);
  if (server !== undefined) {
    const given = [...WORKSPACE_FLAGS, ...EXPORT_FLAGS].filter((f) => flags[f] !== undefined);
    if (given.length > 0)
      throw new UsageError(
        `${given.map((f) => `--${f}`).join(", ")} name the workspace, which the server at ${server} has its own of; give them to engram serve`,
      );
    let url: URL;
    try {
      url = new URL(server);
    } catch {
      throw new UsageError(
        `--server ${server} is not a URL such as http://127.0.0.1:${DEFAULT_PORT}`,
      );
    }
    const base = url.href.replace(/\/$/, "");
    const fetch = io.fetch ?? ((request: Request) => globalThis.fetch(request));
    return {
      client: createEngramClient({
        baseUrl: base,
        fetch: wrap(withToken(fetch, io.env[TOKEN_ENV])),
      }),
      workspace: null,
      server: base,
      close: () => undefined,
    };
  }
  // Read before anything is opened, so a bad --otlp is a usage error with nothing touched.
  const exporting = exportConfig(flags, io.env, io.cwd);
  const ws = openWorkspace({
    ...workspace(),
    cwd: io.cwd,
    home: io.home,
    env: io.env,
    newId: io.newId,
  });
  try {
    open?.(ws);
  } catch (e) {
    ws.close();
    throw e;
  }
  // Only a command that opened the log exports: simulate never touches it.
  let decisions: DecisionExport | undefined;
  if (open !== undefined && exportsAnything(exporting)) {
    const failed = exportFailure(io);
    decisions = startExport(ws.deps.db, openSinks(exporting, failed), failed);
  }
  const app = createApp(ws, {
    port: DEFAULT_PORT,
    now: io.now,
    onError: (e) => io.err(`engram: ${e instanceof Error ? e.message : String(e)}\n`),
    ...(decisions ? { decisions } : {}),
  });
  return {
    client: createEngramClient({
      baseUrl: IN_PROCESS_URL,
      fetch: wrap(async (request) => app.fetch(request)),
    }),
    workspace: ws,
    server: undefined,
    close: () => {
      ws.close();
      if (decisions === undefined) return;
      const sent = decisions.close();
      pending.add(sent);
      void sent.finally(() => pending.delete(sent));
    },
  };
}

/** A failed call: 501 is usage (exit 2, naming the card), anything else exit 1 with its message. */
export class CallError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * The body of a call that answered 200, or a thrown CallError (501 thrown as
 * a UsageError, which prints and exits 2). A decision is always a 200.
 */
export function result<T>(answer: {
  data?: T;
  error?: { error: { message: string; card?: string } } | unknown;
  response: Response;
}): T {
  if (answer.response.status === 200 && answer.data !== undefined) return answer.data;
  const body = (answer.error as { error?: { message?: string; card?: string } } | undefined)?.error;
  const message = body?.message ?? `the server answered ${answer.response.status}`;
  if (answer.response.status === 501) throw new UsageError(message);
  throw new CallError(answer.response.status, message);
}
