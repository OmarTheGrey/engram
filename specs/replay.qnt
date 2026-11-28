// -*- mode: Bluespec; -*-
//
// The scheduler under which the code runs the model of specs/commit.qnt
// (card E1.8). Every step of `replayStep` is a step of `good`'s `step`: the
// same instance, the same actions, the same bounds. It only restricts which
// of them may come next, in two ways the code fixes and the model leaves
// free, so that every trace it generates is one the code can follow step by
// step (packages/core/test/model/trace-replay.test.ts replays them on real
// Plane handles over one log).
//
// 1. Atomic continuations. A model step that the code runs in the same
//    synchronous stretch as the step before it, with no store call between
//    (so no other handle can move between them), must follow that step at
//    once, on the same handle. These are: a stale commit and its settle's
//    first read (write.ts decideAndWrite, commit.ts settle), a settle that
//    goes round again and its next read, an erasure and the sweep's listing
//    head (offboard.ts run), each decision of the sweep loop and the next
//    one (or the report), the put-back loop's reads and checks, an
//    offboarding with nothing to erase and its erase transaction, and each
//    record of an adoption and the next one (adopt.ts adoptStoreItems),
//    except where a purge's store delete stands between them.
// 2. The erasure deletes its records in id order (offboard.ts iterates the
//    projection, items ORDER BY id; the replay maps a and b to ids in that
//    order). The orders of the sweep's and adoption's loops follow the
//    store's listing, which the replay's store returns in the order the
//    trace takes them, so those stay free.
//
// An offboarding stops (obStop) only where the code can stop, at a store
// call, so never inside an atomic continuation.
module replay {
  import commit(
    HANDLES = Set("h1", "h2", "h3"),
    ITEMS = Set("a", "b"),
    MAX_CONTENT = 6,
    MAX_EDITS = 2,
    MAX_OFFBOARDS = 2,
    CHECKED = true
  ).* from "./commit"

  // The steps after which the code goes on without a store call between.
  pure val CONTINUES = Set("commitStale", "settleAgain", "obErase", "obSweepKeep", "obSwept",
                           "obSweepChanged", "obPutBackCheck")
  // The adoption steps after which the code takes the next listed record.
  pure val ADOPT_CONTINUES = Set("adoptSkip", "adoptDefer", "adopt", "adoptRefuseErasing")

  // The handle that must take the next step, or "" when any may.
  val forced: str = {
    val h = lastAction.handle
    val n = lastAction.name
    if (h == "") ""
    else {
      val p = pc.get(h)
      if (CONTINUES.contains(n)) h
      else if (n == "obPutBackRead" and p.tag == "obSweep") h
      else if (n == "obBegin" and p.remaining == Set()) h
      else if (ADOPT_CONTINUES.contains(n) and p.tag == "adopt") h
      else ""
    }
  }

  // The erasure's deletes in id order: b only once a is done or not doomed.
  action obDeleteInOrder(h: str, x: str): bool = all {
    x == "a" or not(pc.get(h).remaining.contains("a")),
    obDelete(h, x),
  }

  // The steps a handle can take inside a call it is running.
  action continueOn(h: str): bool = {
    nondet x = ITEMS.oneOf()
    any {
      storeWrite(h),
      commit(h),
      settleRead(h),
      settleStore(h),
      settleConfirm(h),
      obDeleteInOrder(h, x),
      obErase(h),
      obSweepList(h),
      obSweepDecide(h, x),
      obSweepDel(h),
      obSweepCommit(h),
      obPutBackRead(h),
      obPutBackWrite(h),
      obPutBackCheck(h),
      obReport(h),
      adoptOne(h, x),
      adoptPurge(h),
      adoptDone(h),
    }
  }

  action replayStep =
    if (forced != "") continueOn(forced)
    else {
      nondet h = HANDLES.oneOf()
      nondet x = ITEMS.oneOf()
      nondet k = KINDS.oneOf()
      any {
        decide(h, x, k),
        continueOn(h),
        obBegin(h),
        obStop(h),
        adoptList(h),
        outsideEdit(x, k),
        outsideEditMeta(x),
      }
    }
}
