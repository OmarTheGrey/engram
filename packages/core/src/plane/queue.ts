// The write queue (finding N2 of the second review, ADR 0007's amendments):
// every Plane call that changes items over one db handle runs in one queue,
// one at a time, in call order, so each decides against the projection the
// previous one left. Plane.write (plane/write.ts) and Plane.retain
// (plane/retention.ts) run in it; a later call that changes items, such as
// Plane.promote (card E2.5), runs its whole decide-and-commit in one task.
// A task that fails does not stall the queue. Writers in another process
// sharing one log file are not serialised by it.
import type { Db } from "../db/db.ts";

/** The tail of each log's queue, keyed by its db handle. */
const queues = new WeakMap<object, Promise<unknown>>();

/**
 * Runs `task` once every task queued before it on `db` has settled, and
 * resolves or rejects with its outcome. Whatever the task appends and
 * changes is one slot: no other queued task interleaves with it.
 */
export function inWriteQueue<T>(db: Db, task: () => Promise<T> | T): Promise<T> {
  const run = (queues.get(db) ?? Promise.resolve()).then(task);
  queues.set(
    db,
    run.catch(() => undefined),
  );
  return run;
}
