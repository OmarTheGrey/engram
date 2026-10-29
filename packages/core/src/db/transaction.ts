// Nested transactions as savepoints, shared by both backends. The outermost
// call runs the backend's `begin` text (SQLite: BEGIN IMMEDIATE; Postgres:
// BEGIN and the log's advisory lock); nested calls are savepoints. The body
// must be synchronous: a promise would let the transaction commit before the
// awaited work ran.

export function nestedTransactions(
  exec: (sql: string) => void,
  begin: string,
): <T>(fn: () => T) => T {
  let depth = 0;
  return <T>(fn: () => T): T => {
    const outer = depth === 0;
    const name = `sp${depth}`;
    exec(outer ? begin : `SAVEPOINT ${name}`);
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
      try {
        exec(outer ? "ROLLBACK" : `ROLLBACK TO ${name}; RELEASE ${name}`);
      } catch {
        // The connection is gone (a Postgres timeout closes it); the body's error is the one to report.
      }
      throw e;
    } finally {
      depth--;
    }
  };
}
