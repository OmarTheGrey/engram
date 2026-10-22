// The plane's own storage (ADR 0003): a small interface so node:sqlite can be
// swapped for better-sqlite3 or Postgres without touching callers.

export type Row = Record<string, unknown>;
export type Param = string | number | bigint | null | Uint8Array;

export interface Statement {
  run(...params: Param[]): { changes: number | bigint };
  get(...params: Param[]): Row | undefined;
  all(...params: Param[]): Row[];
}

export interface Db {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  /** Runs `fn` atomically; nested calls become savepoints. Rolls back if `fn` throws. */
  transaction<T>(fn: () => T): T;
  close(): void;
}
