// Db over Postgres (ADR 0024), behind the same synchronous contract as
// node:sqlite. Node has no synchronous Postgres driver, so a worker thread
// (postgres-worker.ts) holds one postgres.js connection and the main thread
// posts each statement and blocks on Atomics.wait over a SharedArrayBuffer
// until the worker answers, the synckit pattern.
//
// Timeouts: the server cancels a statement after `timeoutMs` (its
// statement_timeout) and ends a session idle in a transaction after as long
// (idle_in_transaction_session_timeout), so a stalled writer does not keep the
// log's lock; the cancelled statement throws DbTimeoutError and the Db stays
// usable. If no answer comes at all (the server or the worker hangs), the
// main thread gives up after a backstop of `timeoutMs` plus up to five
// seconds, throws DbTimeoutError and closes the Db; the server session may
// then outlive it until the server notices the closed socket.
//
// The connection is pinned: losing it closes the Db (postgres-worker.ts). The
// outermost transaction runs READ COMMITTED and takes a transaction-scoped
// advisory lock on a key derived from the log (its schema), so writers in
// different processes are serialised the way BEGIN IMMEDIATE serialises them
// on one SQLite file; nested calls are savepoints. `?` placeholders are
// rewritten to `$n`.
//
// The worker is loaded by its .ts path through Node's type stripping, which
// works in this workspace; a build of core that ships under node_modules needs
// a compiled postgres-worker.js instead (ADR 0024 amendments).
import { MessageChannel, receiveMessageOnPort, Worker } from "node:worker_threads";
import { type Db, DbTimeoutError, type Param, type Row, type Statement } from "./db.ts";
import { nestedTransactions } from "./transaction.ts";

/** How long the server lets a statement run before DbTimeoutError, unless the caller says otherwise. */
export const POSTGRES_TIMEOUT_MS = 30_000;

/** How long starting the worker and connecting may take; a loaded machine starts a worker slowly. */
export const POSTGRES_CONNECT_TIMEOUT_MS = 60_000;

/**
 * The outer transaction's begin: BEGIN at READ COMMITTED (so a read after the
 * lock sees the previous holder's commit whatever the server's default), then
 * the log's advisory lock, held to COMMIT or ROLLBACK. The key is the log's
 * schema in this database, so two logs in one database do not block each
 * other; a search path naming no existing schema still takes a lock.
 */
export const POSTGRES_BEGIN =
  "BEGIN ISOLATION LEVEL READ COMMITTED; SELECT pg_advisory_xact_lock(hashtext('engram.log'), hashtext(coalesce(current_schema(), '')))";

export interface PostgresOptions {
  /** Milliseconds the server lets a statement run; default POSTGRES_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Milliseconds opening may take; default POSTGRES_CONNECT_TIMEOUT_MS. */
  connectTimeoutMs?: number;
  /** The schema the log lives in, set as the session's search_path when it connects. */
  schema?: string;
}

/** @internal What the worker needs besides the url. */
export interface WorkerSettings {
  connectTimeoutMs: number;
  /** Startup parameters, sent when the connection opens. */
  connection: Record<string, string>;
}

/** @internal The messages between openPostgres and its worker. */
export type Request =
  | { op: "connect" }
  | { op: "exec"; sql: string }
  | { op: "query"; sql: string; params: Param[] }
  | { op: "close" };

/** @internal `fatal`: the connection is gone and the Db must close. */
export type Response =
  | { ok: true; rows: Row[]; changes: number }
  | { ok: false; message: string; code: string | undefined; fatal: boolean };

const IDENT = /[A-Za-z0-9_$]/;
const DOLLAR_TAG = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/;

/** Where the string literal opening at `i` ends (one past its closing quote). */
function stringEnd(sql: string, i: number): number {
  const escapes = (sql[i - 1] === "E" || sql[i - 1] === "e") && !IDENT.test(sql[i - 2] ?? "");
  let end = i + 1;
  while (end < sql.length) {
    if (escapes && sql[end] === "\\") end += 2;
    else if (sql[end] === "'" && sql[end + 1] === "'") end += 2;
    else if (sql[end] === "'") return end + 1;
    else end++;
  }
  return sql.length;
}

/** Where the block comment opening at `i` ends; block comments nest in Postgres. */
function commentEnd(sql: string, i: number): number {
  let depth = 0;
  let end = i;
  do {
    if (sql.startsWith("/*", end)) {
      depth++;
      end += 2;
    } else if (sql.startsWith("*/", end)) {
      depth--;
      end += 2;
    } else end++;
  } while (depth > 0 && end < sql.length);
  return end;
}

/**
 * Rewrites SQLite's `?` placeholders to Postgres's `$1`, `$2`, ... in order,
 * leaving a `?` inside a quoted string (with `E''` backslash escapes), a
 * quoted identifier, a dollar-quoted body or a comment (nested block comments
 * included) alone. `??` is a literal `?`, for Postgres's jsonb operators
 * (`body ?? 'key'`); SQLite's numbered `?1` placeholders are refused.
 */
export function rewritePlaceholders(sql: string): string {
  let out = "";
  let n = 0;
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    let end = i + 1;
    if (c === "'") {
      end = stringEnd(sql, i);
    } else if (c === '"') {
      end = sql.indexOf(c, i + 1);
      while (end !== -1 && sql[end + 1] === c) end = sql.indexOf(c, end + 2);
      end = end === -1 ? sql.length : end + 1;
    } else if (c === "$" && !IDENT.test(sql[i - 1] ?? "")) {
      const tag = DOLLAR_TAG.exec(sql.slice(i))?.[0];
      if (tag) {
        const close = sql.indexOf(tag, i + tag.length);
        end = close === -1 ? sql.length : close + tag.length;
      }
    } else if (c === "-" && sql[i + 1] === "-") {
      end = sql.indexOf("\n", i);
      if (end === -1) end = sql.length;
    } else if (c === "/" && sql[i + 1] === "*") {
      end = commentEnd(sql, i);
    } else if (c === "?") {
      if (sql[i + 1] === "?") {
        out += "?";
        i += 2;
        continue;
      }
      if (/[0-9]/.test(sql[i + 1] ?? "")) {
        throw new Error(`numbered placeholders (?1) are not supported on Postgres: ${sql}`);
      }
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
 * Whether a failed statement is the server's statement timeout: SQLSTATE
 * 57014 (query_canceled) after at least `timeoutMs`, the statement_timeout
 * this connection set. Decided by the code and the elapsed time, never by the
 * message, which follows the server's lc_messages (review finding P2-14); a
 * 57014 sooner is another cancel (pg_cancel_backend).
 */
export function isServerTimeout(
  code: string | undefined,
  elapsedMs: number,
  timeoutMs: number,
): boolean {
  return code === "57014" && elapsedMs >= timeoutMs;
}

/**
 * Opens a Postgres log at `url` (postgres://user:password@host:port/database),
 * in `options.schema` when given. Throws when the server cannot be reached
 * within the connect timeout, or at once when the driver cannot start (a url
 * it cannot parse). Call close() when done; an unclosed Db does not keep the
 * process alive.
 */
export function openPostgres(url: string, options: PostgresOptions = {}): Db {
  const timeoutMs = options.timeoutMs ?? POSTGRES_TIMEOUT_MS;
  const connectTimeoutMs = options.connectTimeoutMs ?? POSTGRES_CONNECT_TIMEOUT_MS;
  // The client's backstop: the server cancels at timeoutMs, so this fires only
  // when nothing answers at all.
  const backstopMs = timeoutMs + Math.min(timeoutMs, 5000);
  const settings: WorkerSettings = {
    connectTimeoutMs,
    connection: {
      statement_timeout: String(timeoutMs),
      idle_in_transaction_session_timeout: String(timeoutMs),
      ...(options.schema ? { search_path: options.schema } : {}),
    },
  };
  const flag = new SharedArrayBuffer(4);
  const signal = new Int32Array(flag);
  const { port1, port2 } = new MessageChannel();
  const worker = new Worker(new URL("./postgres-worker.ts", import.meta.url), {
    workerData: { url, flag, port: port2, settings },
    transferList: [port2],
  });
  worker.unref();
  port1.unref();
  let closed: string | undefined;

  const shut = () => {
    void worker.terminate();
    port1.close();
  };

  const call = (req: Request, wait = backstopMs): Response & { ok: true } => {
    if (closed) throw new Error(`postgres Db is closed: ${closed}`);
    const what = req.op === "query" || req.op === "exec" ? req.sql : req.op;
    const started = Date.now();
    Atomics.store(signal, 0, 0);
    port1.postMessage(req);
    if (Atomics.wait(signal, 0, 0, wait) === "timed-out") {
      closed = `no answer within ${wait} ms to ${what}`;
      shut();
      throw new DbTimeoutError(`postgres: ${closed}; the Db is closed`);
    }
    const res = receiveMessageOnPort(port1)?.message as Response | undefined;
    if (!res) throw new Error("postgres worker signalled without a reply");
    if (res.ok) return res;
    if (res.fatal) {
      closed = res.message;
      shut();
      throw Object.assign(new Error(`postgres: ${res.message}; the Db is closed`), {
        code: res.code,
      });
    }
    if (isServerTimeout(res.code, Date.now() - started, timeoutMs)) {
      throw new DbTimeoutError(`postgres: the server cancelled ${what} after ${timeoutMs} ms`);
    }
    throw Object.assign(new Error(res.message), { code: res.code });
  };

  const exec = (sql: string) => {
    call({ op: "exec", sql });
  };

  try {
    call({ op: "connect" }, connectTimeoutMs);
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
