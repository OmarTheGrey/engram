// Db over node:sqlite (unflagged in Node 22.13 and later; no native build).
// A file database runs in WAL mode and waits up to five seconds for a lock,
// so several processes can share one log. The outermost transaction begins
// IMMEDIATE, taking the write lock before it reads, so a sequence number read
// inside it cannot be taken by another connection; nested calls are savepoints.
import { DatabaseSync } from "node:sqlite";
import type { Db, Param, Row, Statement } from "./db.ts";

export const BUSY_TIMEOUT_MS = 5000;

export function openSqlite(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  let depth = 0;

  const begin = (name: string) => db.exec(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${name}`);
  const commit = (name: string, outer: boolean) => db.exec(outer ? "COMMIT" : `RELEASE ${name}`);
  const rollback = (name: string, outer: boolean) =>
    db.exec(outer ? "ROLLBACK" : `ROLLBACK TO ${name}; RELEASE ${name}`);

  return {
    exec: (sql) => db.exec(sql),
    prepare(sql): Statement {
      const s = db.prepare(sql);
      return {
        run: (...p: Param[]) => s.run(...p),
        get: (...p: Param[]) => s.get(...p) as Row | undefined,
        all: (...p: Param[]) => s.all(...p) as Row[],
      };
    },
    transaction<T>(fn: () => T): T {
      const outer = depth === 0;
      const name = `sp${depth}`;
      begin(name);
      depth++;
      try {
        const result = fn();
        if (result instanceof Promise) {
          void result.catch(() => {});
          throw new Error("Db.transaction takes a synchronous body; await outside the transaction");
        }
        commit(name, outer);
        return result;
      } catch (e) {
        rollback(name, outer);
        throw e;
      } finally {
        depth--;
      }
    },
    close: () => db.close(),
  };
}
