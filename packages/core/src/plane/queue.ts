// The write queue (finding N2 of the second review, ADR 0007's amendments):
// every Plane call that changes items over one db handle runs in one queue,
// one at a time, in call order, so each decides against the projection the
// previous one left. Plane.write (plane/write.ts), Plane.retain
// (plane/retention.ts) and adoption's retractions (plane/adopt.ts) run in it;
// a later call that changes items, such as Plane.promote (card E2.5), runs
// its whole decide-and-commit in one task. A task that fails does not stall
// the queue. Writers in another process sharing one log file are not
// serialised by it.
//
// A task must never enter the queue again on the same db: it would wait for
// itself and stall the log's queue for good. Such a call throws at once
// (review finding P4-8). Inside a task, use the in-slot primitives, which
// append synchronously: enforceBudget (plane/retention.ts) and appendEvent.
import { AsyncLocalStorage } from "node:async_hooks";
import type { Db } from "../db/db.ts";

/** The tail of each log's queue, keyed by its db handle. */
const queues = new WeakMap<object, Promise<unknown>>();

/** The db handles whose queue slot the current async context is running in. */
const inside = new AsyncLocalStorage<ReadonlySet<object>>();

/** A call to inWriteQueue from inside a task on the same db. */
export class NestedWriteQueueError extends Error {
  constructor() {
    super(
      "inWriteQueue called from inside the write queue on the same db: it would wait for itself; use the in-slot primitives (enforceBudget, appendEvent) instead",
    );
    this.name = "NestedWriteQueueError";
  }
}

/**
 * Runs `task` once every task queued before it on `db` has settled, and
 * resolves or rejects with its outcome. Whatever the task appends and
 * changes is one slot: no other queued task interleaves with it. Rejects
 * with NestedWriteQueueError, without queueing, when called from inside a
 * task on the same db.
 */
export function inWriteQueue<T>(db: Db, task: () => Promise<T> | T): Promise<T> {
  const held = inside.getStore();
  if (held?.has(db)) return Promise.reject(new NestedWriteQueueError());
  const slot = new Set([...(held ?? []), db]);
  const run = (queues.get(db) ?? Promise.resolve()).then(() => inside.run(slot, task));
  queues.set(
    db,
    run.catch(() => undefined),
  );
  return run;
}
