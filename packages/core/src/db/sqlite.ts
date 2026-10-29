// Db over node:sqlite (unflagged in Node 22.13 and later; no native build).
// A file database runs in WAL mode and waits up to five seconds for a lock,
// so several processes can share one log. The outermost transaction begins
// IMMEDIATE, taking the write lock before it reads, so a sequence number read
// inside it cannot be taken by another connection; nested calls are savepoints.
import { DatabaseSync } from "node:sqlite";
import type { Db, Param, Row, Statement } from "./db.ts";
import { nestedTransactions } from "./transaction.ts";

export const BUSY_TIMEOUT_MS = 5000;

export function openSqlite(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");

  return {
    dialect: "sqlite",
    exec: (sql) => db.exec(sql),
    prepare(sql): Statement {
      const s = db.prepare(sql);
      return {
        run: (...p: Param[]) => s.run(...p),
        get: (...p: Param[]) => s.get(...p) as Row | undefined,
        all: (...p: Param[]) => s.all(...p) as Row[],
      };
    },
    transaction: nestedTransactions((sql) => db.exec(sql), "BEGIN IMMEDIATE"),
    close: () => db.close(),
  };
}
