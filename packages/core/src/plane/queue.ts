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
// Only real nesting is refused (P4-16): the async context remembers which
// slot a call was made from, and a call counts as nested only while that
// slot is still running, so a timer or listener created in a slot that fires
// after the slot has ended queues normally.
import { AsyncLocalStorage } from "node:async_hooks";
import type { Db } from "../db/db.ts";

/** The tail of each log's queue, keyed by its db handle. */
const queues = new WeakMap<object, Promise<unknown>>();

/** The slot each db's queue is running now, if any. */
const running = new WeakMap<object, symbol>();

/** The slots, per db, whose async context the current call was made from. */
const inside = new AsyncLocalStorage<ReadonlyMap<object, symbol>>();

/** A call to inWriteQueue from inside a running task on the same db. */
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
 * task on the same db that is still running.
 */
export function inWriteQueue<T>(db: Db, task: () => Promise<T> | T): Promise<T> {
  const held = inside.getStore();
  const from = held?.get(db);
  if (from !== undefined && running.get(db) === from)
    return Promise.reject(new NestedWriteQueueError());
  const slot = Symbol("write-queue-slot");
  const context = new Map(held ?? []);
  context.set(db, slot);
  const run = (queues.get(db) ?? Promise.resolve()).then(async () => {
    running.set(db, slot);
    try {
      return await inside.run(context, task);
    } finally {
      if (running.get(db) === slot) running.delete(db);
    }
  });
  queues.set(
    db,
    run.catch(() => undefined),
  );
  return run;
}
