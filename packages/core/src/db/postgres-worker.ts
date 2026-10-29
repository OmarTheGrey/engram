// The worker thread behind openPostgres (postgres.ts, ADR 0024). It holds one
// postgres.js connection and answers one request at a time: it posts the reply
// on its port, then raises the shared flag the main thread waits on with
// Atomics.wait, which then takes the reply with receiveMessageOnPort.
//
// The connection is pinned: once it has been established, losing it is fatal
// and every later request is refused, because postgres.js would otherwise
// reconnect a fresh session in the middle of a transaction, without the BEGIN,
// the advisory lock or the session's settings (review finding P2-1). A failure
// to start, an uncaught error or an exit is reported to the request in flight
// at once rather than left to the main thread's timeout (P2-2).
import { type MessagePort, workerData } from "node:worker_threads";
import type postgres from "postgres";
import type { Request, Response, WorkerSettings } from "./postgres.ts";

const { url, flag, port, settings } = workerData as {
  url: string;
  flag: SharedArrayBuffer;
  port: MessagePort;
  settings: WorkerSettings;
};
const signal = new Int32Array(flag);

type Sql = postgres.Sql<{ bigint: bigint; numeric: number | bigint }>;

let sql: Sql | undefined;
let fatal: string | undefined;
let connected = false;
let closing = false;
let inFlight = false;

const message = (e: unknown) => String((e as { message?: unknown })?.message ?? e);

function reply(res: Response): void {
  inFlight = false;
  port.postMessage(res);
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
}

function die(cause: string): void {
  fatal ??= cause;
  if (inFlight) reply({ ok: false, message: fatal, code: "ENGRAM_CONNECTION_LOST", fatal: true });
}

process.on("uncaughtException", (e) => die(`the Postgres worker failed: ${message(e)}`));
process.on("unhandledRejection", (e) => die(`the Postgres worker failed: ${message(e)}`));
process.on("exit", () => die("the Postgres worker exited"));

// An error that means the session is gone: the driver's own connection
// errors, and Postgres's admin shutdown (57P), connection exception (08) and
// idle-in-transaction timeout (25P03) codes.
const LOST = /^(CONNECTION_|57P|08|25P03$)/;

try {
  const { default: postgres } = await import("postgres");
  sql = postgres(url, {
    max: 1,
    idle_timeout: 0,
    max_lifetime: null,
    connect_timeout: Math.max(1, Math.ceil(settings.connectTimeoutMs / 1000)),
    onnotice: () => {},
    onclose: () => {
      if (connected && !closing) die("the connection to Postgres was lost");
    },
    types: {
      bigint: postgres.BigInt,
      // numeric (sum, avg): a number, or a bigint for an integer beyond 2^53.
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (x: unknown) => String(x),
        parse: (x: string) => (/^-?\d+$/.test(x) ? BigInt(x) : Number(x)),
      },
    },
    connection: settings.connection,
  });
} catch (e) {
  fatal = `could not start the Postgres driver: ${message(e)}`;
}

// Rows cross to the main thread by structured clone. An int8 or an integral
// numeric arrives as a number when it is a safe integer, as node:sqlite returns
// it, and as a bigint otherwise; a boolean as 1 or 0, as SQLite has no
// boolean; a bytea as a Uint8Array, as a SQLite blob does.
function value(v: unknown): unknown {
  if (typeof v === "bigint") return Number.isSafeInteger(Number(v)) ? Number(v) : v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Uint8Array) return new Uint8Array(v);
  return v;
}

function rows(result: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return result.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, value(v)])));
}

async function answer(db: Sql, req: Request): Promise<Response> {
  switch (req.op) {
    case "connect":
      await db.unsafe("SELECT 1");
      connected = true;
      return { ok: true, rows: [], changes: 0 };
    case "exec":
      await db.unsafe(req.sql).simple();
      return { ok: true, rows: [], changes: 0 };
    case "query": {
      const result = await db.unsafe(req.sql, req.params as never[]);
      return { ok: true, rows: rows(result), changes: result.count ?? 0 };
    }
    case "close":
      closing = true;
      await db.end({ timeout: 5 });
      return { ok: true, rows: [], changes: 0 };
  }
}

port.on("message", (req: Request) => {
  inFlight = true;
  if (fatal || !sql) {
    reply({
      ok: false,
      message: fatal ?? "no driver",
      code: "ENGRAM_CONNECTION_LOST",
      fatal: true,
    });
    return;
  }
  answer(sql, req).then(
    (res) => {
      if (inFlight) reply(res);
    },
    (e: unknown) => {
      if (!inFlight) return;
      const code = (e as { code?: unknown })?.code;
      const sqlstate = typeof code === "string" ? code : undefined;
      if (connected && sqlstate && LOST.test(sqlstate)) {
        die(`the connection to Postgres was lost: ${message(e)}`);
        return;
      }
      reply({ ok: false, message: message(e), code: sqlstate, fatal: false });
    },
  );
});
