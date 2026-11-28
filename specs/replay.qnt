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
//    synchronous stretch as the step before it, with no store call between,
//    must follow that step at once, on the same handle. The stretch is two
//    or more transactions, each under the log's lock, with the lock released
//    between them: no other handle of the same process can move between
//    them (JavaScript runs the stretch to its end), but a handle in another
//    process can append between two of its transactions. The replay runs
//    every handle in one process, so it covers the single-process schedules
//    only; the cross-process interleavings inside a stretch are checked on
//    the model alone (good's simulation and Apalache), a limit of the replay
//    (specs/README.md). The same holds for the head and listing the sweep and
//    adoption take in one model step (obSweepList, adoptList): the code reads
//    the head, then awaits the store's list. These are: a stale commit and its settle's
//    first read (write.ts decideAndWrite, commit.ts settle), a settle that
//    goes round again and its next read, an erasure and the sweep's listing
//    head (offboard.ts run), each decision of the sweep loop and the next
//    one (or the report), the put-back loop's checks and its next read, an
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
// `sweptIdPurgeRaceReplayTest`, and `replayThreeOffboardings`'s run, restate
// the scenario tests of the two gaps card E1.5 found, as card E1.7 closed
// them, in the order the code takes them.
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
  // stale writer reads what to put back in its commit's stretch. Since card
  // E1.7 the write under the swept id is refused, and the purge deletes the
  // record dropped in by hand: b is no item and has no store record.
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
      .then(decide("h2", "b", USER))
      .expect(log[log.length() - 1].rule == WRITE_ERASED)
      .then(adoptPurge("h3")).then(adoptDone("h3"))
      .expect(all {
        not(proj.get("b").live),
        not(store.get("b").present),
        HANDLES.forall(h => pc.get(h).tag == "idle"),
        safety,
      })

  // The findings of card E1.8 (packages/core/test/model/replay.ts FINDINGS):
  // where the code's state leaves the model's. Each ends in the model's
  // state; trace-replay.test.ts pins the step the code diverges at.

  // E18-F1. While a is being erased and its record is deleted, an adoption
  // lists the store; the code retires a (adopt.ts, the store no longer
  // lists it), an allowed change, so the stale writer's settle goes round
  // again. The model has no retraction: the writer's deny is appended.
  run e18RetractionWhileErasingTest =
    init
      .then(decide("h1", "a", USER)).then(storeWrite("h1")).then(commit("h1"))
      .then(decide("h3", "a", USER)).then(storeWrite("h3"))
      .then(obBegin("h2")).then(obDelete("h2", "a"))
      .then(commit("h3")).then(settleRead("h3")).then(settleStore("h3"))
      .then(adoptList("h1")).then(adoptDone("h1"))
      .then(settleConfirm("h3"))
      .expect(all {
        log[log.length() - 1].rule == WRITE_CONFLICT,
        erasureOpen(log),
        safety,
      })

  // E18-F2. A record dropped into the store while the scope is being erased
  // is refused (engram/offboard/erasing); after the report, the model adopts
  // it. The code does not: the same bytes were denied before.
  run e18ErasingRefusalFinalTest =
    init
      .then(obBegin("h1")).then(obErase("h1")).then(obSweepList("h1"))
      .then(outsideEdit("a", USER))
      .then(adoptList("h2")).then(adoptOne("h2", "a")).then(adoptDone("h2"))
      .then(obReport("h1"))
      .then(adoptList("h3")).then(adoptOne("h3", "a")).then(adoptDone("h3"))
      .expect(all {
        proj.get("a").live,
        proj.get("a").kind == IMPORT,
        safety,
      })

  // E18-F3. A writer's bytes, their confidence edited by hand, are adopted
  // before it commits. The model ignores them as the writer's own (content
  // alike) and commits; the code counts them as a change and settles.
  run e18OwnBytesEditedTest =
    init
      .then(decide("h1", "b", USER)).then(storeWrite("h1")).then(outsideEditMeta("b"))
      .then(adoptList("h2")).then(adoptOne("h2", "b")).then(adoptDone("h2"))
      .then(commit("h1"))
      .expect(all {
        log[log.length() - 1].rule == GATE_ALLOW,
        proj.get("b").kind == USER,
        safety,
      })

  // E18-F4. Two adoptions list the same record under a swept id; the first
  // refuses and purges it. The model defers the second (the refusal is a
  // change since its listing); the code deletes the record again, with no
  // event and no deferral.
  run e18RepeatedPurgeTest =
    init
      .then(decide("h1", "a", USER)).then(storeWrite("h1"))
      .then(obBegin("h2")).then(obErase("h2")).then(obSweepList("h2"))
      .then(obSweepDecide("h2", "a")).then(obSweepDel("h2")).then(obSweepCommit("h2"))
      .then(obReport("h2"))
      .then(commit("h1")).then(settleRead("h1")).then(settleStore("h1")).then(settleConfirm("h1"))
      .then(outsideEdit("a", USER))
      .then(adoptList("h2")).then(adoptList("h3"))
      .then(adoptOne("h2", "a")).then(adoptPurge("h2")).then(adoptDone("h2"))
      .then(adoptOne("h3", "a"))
      .expect(lastAction.name == "adoptDefer")
      .then(adoptDone("h3"))
      .expect(all {
        not(store.get("a").present),
        HANDLES.forall(h => pc.get(h).tag == "idle"),
        safety,
      })

  // E18-F5, as a sampled trace found it (seed 12, trace 210 of 800): two
  // stale writers of b settle while adoptions list the store; a settle's
  // put-back carries a version above the projection's, and the last
  // adoption here records it as a change, which the model, without
  // versions, holds unchanged.
  run e18VersionOnlyTest =
    init
      .then(obBegin("h3")).then(obErase("h3")).then(obSweepList("h3")).then(adoptList("h1"))
      .then(obReport("h3")).then(decide("h3", "b", USER)).then(decide("h2", "b", USER)).then(outsideEdit("a", MODEL))
      .then(outsideEdit("b", MODEL)).then(storeWrite("h3")).then(adoptDone("h1")).then(storeWrite("h2"))
      .then(commit("h3")).then(decide("h1", "a", USER)).then(decide("h3", "a", MODEL)).then(commit("h2"))
      .then(settleRead("h2")).then(storeWrite("h1")).then(storeWrite("h3")).then(commit("h3"))
      .then(commit("h1")).then(settleRead("h1")).then(adoptList("h3")).then(settleStore("h1"))
      .then(settleStore("h2")).then(adoptOne("h3", "a")).then(adoptOne("h3", "b")).then(adoptDone("h3"))
      .then(adoptList("h3")).then(settleConfirm("h2")).then(settleRead("h2")).then(adoptOne("h3", "b"))
      .then(adoptOne("h3", "a")).then(adoptDone("h3")).then(settleConfirm("h1")).then(settleStore("h2"))
      .then(settleConfirm("h2")).then(settleRead("h2")).then(adoptList("h1")).then(adoptList("h3"))
      .then(adoptOne("h3", "b")).then(adoptOne("h3", "a")).then(adoptDone("h3"))
      .expect(all { lastAction.name == "adoptDone", safety })

  // E18-F6. Two stale writers of a new id: the adoption of h1's bytes (at
  // model trust) is withdrawn to nothing. A record dropped in by hand under
  // that id is then adopted at import in the model; the code, which keeps
  // the withdrawn item as retired, takes its kind, model, as the ceiling.
  run e18WithdrawnStillHeldTest =
    init
      .then(decide("h2", "a", USER)).then(decide("h1", "a", MODEL))
      .then(storeWrite("h2")).then(storeWrite("h1"))
      .then(adoptList("h3")).then(adoptOne("h3", "a")).then(adoptDone("h3"))
      .then(commit("h2")).then(settleRead("h2")).then(settleStore("h2")).then(settleConfirm("h2"))
      .then(commit("h1")).then(settleRead("h1"))
      .expect(pc.get("h1").mend)
      .then(settleStore("h1")).then(settleConfirm("h1"))
      .expect(not(proj.get("a").live))
      .then(outsideEdit("a", USER))
      .then(adoptList("h3")).then(adoptOne("h3", "a")).then(adoptDone("h3"))
      .expect(all { proj.get("a").kind == IMPORT, safety })

  // E18-F7. A stale writer's settle deletes a's record just before the
  // erasure reads it, so the erasure records it as not found; another
  // writer's settle, which read a before the mark, writes a's erased
  // content back. Both settles are still in flight when an adoption refuses
  // that record: the model purges it, the code, holding the content as left
  // in the store, does not.
  run e18ErasesWithdrawnTest =
    // E18-F8. As E18-F6's run, a is withdrawn to nothing; then an
    // offboarding. The model has no item to erase; the code still holds a,
    // retired, and erases it.
    init
      .then(decide("h2", "a", USER)).then(decide("h1", "a", MODEL))
      .then(storeWrite("h2")).then(storeWrite("h1"))
      .then(adoptList("h3")).then(adoptOne("h3", "a")).then(adoptDone("h3"))
      .then(commit("h2")).then(settleRead("h2")).then(settleStore("h2")).then(settleConfirm("h2"))
      .then(commit("h1")).then(settleRead("h1")).then(settleStore("h1")).then(settleConfirm("h1"))
      .then(obBegin("h2")).then(obErase("h2")).then(obSweepList("h2")).then(obReport("h2"))
      .expect(all {
        erasedIds == Set(),
        log.select(e => e.rule == ERASE).length() == 0,
        safety,
      })

  run e18NotFoundNoPurgeTest =
    init
      .then(decide("h1", "a", USER)).then(storeWrite("h1")).then(commit("h1"))
      .then(decide("h2", "a", USER)).then(decide("h1", "a", MODEL))
      .then(storeWrite("h2")).then(storeWrite("h1")).then(commit("h1"))
      .then(commit("h2")).then(settleRead("h2"))
      .then(decide("h1", "a", USER)).then(storeWrite("h1"))
      .then(obBegin("h3"))
      .then(commit("h1")).then(settleRead("h1")).then(settleStore("h1"))
      .then(obDelete("h3", "a")).then(obErase("h3")).then(obSweepList("h3"))
      .then(settleStore("h2"))
      .expect(all { erasedIds.contains("a"), erasedContent.contains(store.get("a").content) })
      .then(obReport("h3"))
      .then(adoptList("h3")).then(adoptOne("h3", "a"))
      .expect(all { pc.get("h3").tag == "adoptPurge", safety })
}

// threeOffboardings's instance: three offboardings.
module replayThreeOffboardings {
  import commit(
    HANDLES = Set("h1", "h2", "h3"),
    ITEMS = Set("a", "b"),
    MAX_CONTENT = 6,
    MAX_EDITS = 2,
    MAX_OFFBOARDS = 3,
    CHECKED = true
  ).* from "./commit"

  // threeOffboardings::putBackAcrossThirdErasureTest in the order the code
  // takes it: the first two offboardings, with nothing to erase, list the
  // store at once. Since card E1.7 the put-back's last read finds b gone and
  // deletes the record its previous round wrote, and the first offboarding
  // reports in the stretch after that delete. It ends where the model says
  // the code ends: b erased, no store record, every handle idle.
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
      .then(obPutBackWrite("h1")).then(obPutBackCheck("h1"))
      .then(obReport("h1"))
      .then(obReport("h2"))
      .expect(all {
        erasedIds.contains("b"),
        not(store.get("b").present),
        HANDLES.forall(h => pc.get(h).tag == "idle"),
        safety,
      })

  // A known limit, pinned (card E1.7's review): the first offboarding stops
  // just after its put-back wrote b's erased content back (a crash there, a
  // failed delete on the next round, or the fourth round's give-up). No
  // handle is left to delete it: erasureHolds is false in the model too, in
  // a state seed 1's simulation rarely samples. The model's next adoption
  // refuses and purges the record; the code's refuses it without a purge,
  // since the third erasure found no record at b's ref (E18-F7, whose rule
  // card E1.7 keeps; card X19 measures that residue).
  run putBackCrashReplayTest =
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
      .then(obPutBackWrite("h1"))
      .then(obStop("h1"))
      .then(obReport("h2"))
      .expect(all {
        store.get("b").present,
        erasedContent.contains(store.get("b").content),
        HANDLES.forall(h => pc.get(h).tag == "idle"),
        not(erasureHolds),
      })
      .then(adoptList("h3")).then(adoptOne("h3", "b"))
      .expect(pc.get("h3").tag == "adoptPurge")
      .then(adoptPurge("h3")).then(adoptDone("h3"))
      .expect(all { not(store.get("b").present), safety })
}
