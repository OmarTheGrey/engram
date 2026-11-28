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
//
// The module `replay` is good's instance under this schedule: the traces of
// specs/traces/ are its runs, and each is a run of good. Its run
// `sweptIdPurgeRaceReplayTest`, and `replayThreeOffboardings`'s run, restate the
// two known gaps' scenario tests in the order the code takes them.
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

  // good::sweptIdPurgeRaceTest in the order the code takes it: the
  // offboarding with nothing to erase lists the store at once, and the
  // stale writer reads what to put back in its commit's stretch. The state
  // it ends in is the one the model states: b projected, no store record.
  run sweptIdPurgeRaceReplayTest =
    init
      .then(decide("h1", "b", USER)).then(storeWrite("h1"))
      .then(obBegin("h2")).then(obErase("h2")).then(obSweepList("h2"))
      .then(obSweepDecide("h2", "b")).then(obSweepDel("h2")).then(obSweepCommit("h2"))
      .then(obReport("h2"))
      .then(commit("h1")).then(settleRead("h1")).then(settleStore("h1")).then(settleConfirm("h1"))
      .then(outsideEdit("b", USER))
      .then(adoptList("h3")).then(adoptOne("h3", "b"))
      .expect(pc.get("h3").tag == "adoptPurge")
      .then(decide("h2", "b", USER)).then(storeWrite("h2")).then(commit("h2"))
      .then(adoptPurge("h3")).then(adoptDone("h3"))
      .expect(all {
        proj.get("b").live,
        not(store.get("b").present),
        HANDLES.forall(h => pc.get(h).tag == "idle"),
        safety,
      })
}

// knownGapThreeOffboardings's instance: three offboardings.
module replayThreeOffboardings {
  import commit(
    HANDLES = Set("h1", "h2", "h3"),
    ITEMS = Set("a", "b"),
    MAX_CONTENT = 6,
    MAX_EDITS = 2,
    MAX_OFFBOARDS = 3,
    CHECKED = true
  ).* from "./commit"

  // knownGapThreeOffboardings::putBackAcrossThirdErasureTest in the order
  // the code takes it: the first two offboardings, with nothing to erase,
  // list the store at once; the put-back's last read finds b gone and the
  // first offboarding reports in the same stretch. It ends where the model
  // says the code ends: b erased, its erased content in the store, every
  // handle idle.
  run putBackAcrossThirdErasureReplayTest =
    init
      .then(decide("h3", "b", USER)).then(storeWrite("h3"))
      .then(obBegin("h1")).then(obErase("h1")).then(obSweepList("h1"))
      .then(obSweepDecide("h1", "b"))
      .then(commit("h3")).then(settleRead("h3")).then(settleStore("h3")).then(settleConfirm("h3"))
      .then(obBegin("h2")).then(obErase("h2")).then(obSweepList("h2")).then(obReport("h2"))
      .then(decide("h2", "b", USER)).then(storeWrite("h2")).then(commit("h2"))
      .expect(proj.get("b").live)
      .then(obSweepDel("h1")).then(obSweepCommit("h1"))
      .expect(pc.get("h1").tag == "obPutBackRead")
      .then(obPutBackRead("h1"))
      .then(obBegin("h2")).then(obDelete("h2", "b")).then(obErase("h2")).then(obSweepList("h2"))
      .then(obPutBackWrite("h1")).then(obPutBackCheck("h1")).then(obPutBackRead("h1"))
      .then(obReport("h1"))
      .then(obReport("h2"))
      .expect(all {
        erasedIds.contains("b"),
        store.get("b").present,
        erasedContent.contains(store.get("b").content),
        HANDLES.forall(h => pc.get(h).tag == "idle"),
        noStaleAppend,
        noWriteWhileErasing,
        not(erasureHolds),
      })
}
