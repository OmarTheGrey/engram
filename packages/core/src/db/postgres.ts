// Db over Postgres (ADR 0024), behind the same synchronous contract as
// node:sqlite. Node has no synchronous Postgres driver, so a worker thread
// (postgres-worker.ts) holds one postgres.js connection and the main thread
// posts each statement and blocks on Atomics.wait over a SharedArrayBuffer
// until the worker answers, the synckit pattern. A statement that does not
// answer within the timeout throws DbTimeoutError and closes the connection.
//
// The outermost transaction takes a transaction-scoped advisory lock on a key
// derived from the log (its schema), so writers in different processes are
// serialised the way BEGIN IMMEDIATE serialises them on one SQLite file;
// nested calls are savepoints. `?` placeholders are rewritten to `$n`.
import { MessageChannel, receiveMessageOnPort, Worker } from "node:worker_threads";
import { type Db, DbTimeoutError, type Param, type Row, type Statement } from "./db.ts";
import { nestedTransactions } from "./transaction.ts";

/** How long a statement may take before DbTimeoutError, unless the caller says otherwise. */
export const POSTGRES_TIMEOUT_MS = 30_000;

/** How long starting the worker and connecting may take; a loaded machine starts a worker slowly. */
export const POSTGRES_CONNECT_TIMEOUT_MS = 60_000;

/**
 * The outer transaction's begin: BEGIN, then the log's advisory lock, held to
 * COMMIT or ROLLBACK. The key is the log's schema in this database, so two
 * logs in one database do not block each other.
 */
export const POSTGRES_BEGIN =
  "BEGIN; SELECT pg_advisory_xact_lock(hashtext('engram.log'), hashtext(current_schema()))";

export interface PostgresOptions {
  /** Milliseconds a statement may take; default POSTGRES_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Milliseconds opening may take; default POSTGRES_CONNECT_TIMEOUT_MS. */
  connectTimeoutMs?: number;
}

/** @internal The messages between openPostgres and its worker. */
export type Request =
  | { op: "connect" }
  | { op: "exec"; sql: string }
  | { op: "query"; sql: string; params: Param[] }
  | { op: "close" };

/** @internal */
export type Response =
  | { ok: true; rows: Row[]; changes: number }
  | { ok: false; message: string; code: string | undefined };

/**
 * Rewrites SQLite's `?` placeholders to Postgres's `$1`, `$2`, ... in order,
 * leaving a `?` inside a quoted string, a quoted identifier or a comment alone.
 */
export function rewritePlaceholders(sql: string): string {
  let out = "";
  let n = 0;
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    let end = i + 1;
    if (c === "'" || c === '"') {
      end = sql.indexOf(c, i + 1);
      while (end !== -1 && sql[end + 1] === c) end = sql.indexOf(c, end + 2);
      end = end === -1 ? sql.length : end + 1;
    } else if (c === "-" && sql[i + 1] === "-") {
      end = sql.indexOf("\n", i);
      if (end === -1) end = sql.length;
    } else if (c === "/" && sql[i + 1] === "*") {
      end = sql.indexOf("*/", i + 2);
      end = end === -1 ? sql.length : end + 2;
    } else if (c === "?") {
      out += `$${++n}`;
      i++;
      continue;
    }
    out += sql.slice(i, end);
    i = end;
  }
  return out;
}

/**
 * Opens a Postgres log at `url` (postgres://user:password@host:port/database).
 * Throws when the server cannot be reached within the timeout. Call close()
 * when done; an unclosed Db does not keep the process alive.
 */
export function openPostgres(url: string, options: PostgresOptions = {}): Db {
  const timeoutMs = options.timeoutMs ?? POSTGRES_TIMEOUT_MS;
  const flag = new SharedArrayBuffer(4);
  const signal = new Int32Array(flag);
  const { port1, port2 } = new MessageChannel();
  const worker = new Worker(new URL("./postgres-worker.ts", import.meta.url), {
    workerData: { url, flag, port: port2 },
    transferList: [port2],
  });
  worker.unref();
  port1.unref();
  let closed: string | undefined;

  const shut = () => {
    void worker.terminate();
    port1.close();
  };

  const call = (req: Request, wait = timeoutMs): Response & { ok: true } => {
    if (closed) throw new Error(`postgres Db is closed: ${closed}`);
    Atomics.store(signal, 0, 0);
    port1.postMessage(req);
    if (Atomics.wait(signal, 0, 0, wait) === "timed-out") {
      const what = req.op === "query" || req.op === "exec" ? req.sql : req.op;
      closed = `no answer within ${wait} ms to ${what}`;
      shut();
      throw new DbTimeoutError(`postgres: ${closed}; the connection is closed`);
    }
    const res = receiveMessageOnPort(port1)?.message as Response | undefined;
    if (!res) throw new Error("postgres worker signalled without a reply");
    if (!res.ok) throw Object.assign(new Error(res.message), { code: res.code });
    return res;
  };

  const exec = (sql: string) => {
    call({ op: "exec", sql });
  };

  try {
    call({ op: "connect" }, options.connectTimeoutMs ?? POSTGRES_CONNECT_TIMEOUT_MS);
  } catch (e) {
    closed ??= "the connection failed";
    shut();
    throw e;
  }

  return {
    dialect: "postgres",
    exec,
    prepare(sql): Statement {
      const text = rewritePlaceholders(sql);
      const query = (params: Param[]) => call({ op: "query", sql: text, params });
      return {
        run: (...p: Param[]) => ({ changes: query(p).changes }),
        get: (...p: Param[]) => query(p).rows[0],
        all: (...p: Param[]) => query(p).rows,
      };
    },
    transaction: nestedTransactions(exec, POSTGRES_BEGIN),
    close() {
      if (closed) return;
      try {
        call({ op: "close" });
      } finally {
        closed = "close() was called";
        shut();
      }
    },
  };
}
