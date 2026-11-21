// A Db that counts what the plane asks of it (card X15): every `prepare`,
// every statement execution (`run`, `get`, `all`), the rows those return,
// every `exec` and every `transaction` call, nested ones included. It
// changes nothing the plane sees; the counts depend only on the calls made
// and the log's state, so they are deterministic and are asserted exactly
// (test/bench/count.test.ts). Statements stay constant while a call's work
// grows with the log; the rows read show that growth (review finding X15-2).
import type { Db, Param, Statement } from "../src/db/db.ts";

export interface QueryCounts {
  /** `Db.prepare` calls. */
  prepares: number;
  /** Statement executions: `run`, `get` and `all` on a prepared statement. */
  statements: number;
  /** Rows the statements returned: each row of an `all`, one for a `get` that found a row. */
  rows: number;
  /** `Db.exec` calls made by the caller (not the backend's own BEGIN and COMMIT). */
  execs: number;
  /** `Db.transaction` calls, nested ones (savepoints) included. */
  transactions: number;
}

export interface CountingDb {
  db: Db;
  /** The counts since the last reset. */
  counts(): QueryCounts;
  reset(): void;
}

const zero = (): QueryCounts => ({
  prepares: 0,
  statements: 0,
  rows: 0,
  execs: 0,
  transactions: 0,
});

export function countingDb(inner: Db): CountingDb {
  let c = zero();
  const db: Db = {
    dialect: inner.dialect,
    exec(sql) {
      c.execs++;
      inner.exec(sql);
    },
    prepare(sql): Statement {
      c.prepares++;
      const s = inner.prepare(sql);
      return {
        run: (...p: Param[]) => {
          c.statements++;
          return s.run(...p);
        },
        get: (...p: Param[]) => {
          c.statements++;
          const row = s.get(...p);
          if (row !== undefined) c.rows++;
          return row;
        },
        all: (...p: Param[]) => {
          c.statements++;
          const rows = s.all(...p);
          c.rows += rows.length;
          return rows;
        },
      };
    },
    transaction(fn) {
      c.transactions++;
      return inner.transaction(fn);
    },
    close: () => inner.close(),
  };
  return {
    db,
    counts: () => ({ ...c }),
    reset: () => {
      c = zero();
    },
  };
}
