// Nested transactions as savepoints, shared by both backends. The outermost
// call runs the backend's `begin` text (SQLite: BEGIN IMMEDIATE; Postgres:
// BEGIN and the log's advisory lock); nested calls are savepoints. The body
// must be synchronous: a promise would let the transaction commit before the
// awaited work ran.
//
// When a rollback itself fails, the body's error is the one thrown. That only
// happens when the connection is gone: a lost Postgres connection closes the
// Db (postgres-worker.ts), so no later statement can commit the outer work.
// Before card E1.1 the rollback's error replaced the body's on SQLite.

export function nestedTransactions(
  exec: (sql: string) => void,
  begin: string,
): <T>(fn: () => T) => T {
  let depth = 0;
  const attempt = (sql: string) => {
    try {
      exec(sql);
    } catch {
      // see the note above
    }
  };
  return <T>(fn: () => T): T => {
    const outer = depth === 0;
    const name = `sp${depth}`;
    try {
      exec(outer ? begin : `SAVEPOINT ${name}`);
    } catch (e) {
      // A begin of several statements (Postgres: BEGIN, then the lock) may
      // fail after BEGIN opened the transaction, for instance on a lock
      // timeout; close it, or every later statement would fail.
      if (outer) attempt("ROLLBACK");
      throw e;
    }
    depth++;
    try {
      const result = fn();
      if (result instanceof Promise) {
        void result.catch(() => {});
        throw new Error("Db.transaction takes a synchronous body; await outside the transaction");
      }
      exec(outer ? "COMMIT" : `RELEASE ${name}`);
      return result;
    } catch (e) {
      attempt(outer ? "ROLLBACK" : `ROLLBACK TO ${name}; RELEASE ${name}`);
      throw e;
    } finally {
      depth--;
    }
  };
}
