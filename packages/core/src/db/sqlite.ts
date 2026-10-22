// Db over node:sqlite (unflagged in Node 22.13 and later; no native build).
import { DatabaseSync } from "node:sqlite";
import type { Db, Param, Row, Statement } from "./db.ts";

export function openSqlite(path: string): Db {
  const db = new DatabaseSync(path);
  let depth = 0;
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
      const name = `sp${depth++}`;
      db.exec(`SAVEPOINT ${name}`);
      try {
        const result = fn();
        db.exec(`RELEASE ${name}`);
        return result;
      } catch (e) {
        db.exec(`ROLLBACK TO ${name}`);
        db.exec(`RELEASE ${name}`);
        throw e;
      } finally {
        depth--;
      }
    },
    close: () => db.close(),
  };
}
