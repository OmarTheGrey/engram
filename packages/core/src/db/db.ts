// The plane's own storage (ADR 0003, ADR 0024): a small synchronous interface
// with two backends, node:sqlite (sqlite.ts) and Postgres on a worker thread
// (postgres.ts). The contract both pass is packages/core/test/db/contract.ts.

export type Row = Record<string, unknown>;
export type Param = string | number | bigint | null | Uint8Array;

/** The SQL dialect a backend speaks; migrations keep dialect-only text behind it. */
export type Dialect = "sqlite" | "postgres";

export interface Statement {
  run(...params: Param[]): { changes: number | bigint };
  get(...params: Param[]): Row | undefined;
  all(...params: Param[]): Row[];
}

export interface Db {
  readonly dialect: Dialect;
  exec(sql: string): void;
  prepare(sql: string): Statement;
  /** Runs `fn` atomically; nested calls become savepoints. Rolls back if `fn` throws. `fn` must be synchronous. */
  transaction<T>(fn: () => T): T;
  close(): void;
}

/**
 * A statement ran past the backend's timeout. On Postgres, a statement the
 * server cancelled leaves the Db usable; when nothing answered at all, the Db
 * is closed and the server session may outlive it (postgres.ts).
 */
export class DbTimeoutError extends Error {
  override readonly name = "DbTimeoutError";
}
