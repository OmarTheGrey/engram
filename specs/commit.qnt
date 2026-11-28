// -*- mode: Bluespec; -*-
//
// A model of the commit and erasure protocol of card E2.6 (card E1.5).
//
// Several handles (processes) share one event log and one store. Each handle
// runs one call at a time (the write queue, packages/core/src/plane/queue.ts,
// orders the calls of one handle), and every step below that reads or appends
// the log is one transaction under the log's lock (BEGIN IMMEDIATE on SQLite,
// the advisory lock on Postgres, ADR 0024). A store call is never inside a
// transaction, so a store write or delete is a step of its own, and any other
// handle may move between it and the transaction that follows it.
//
// What is modelled: one person scope P holding the items in ITEMS; gated
// writes that decide at the head, write the store, and append conditionally
// (packages/core/src/plane/write.ts decideAndWrite, commit.ts staleness); the
// stale writer's settle, including the withdrawal of an adoption of its own
// bytes (commit.ts settle, recovery); offboarding's begin mark, deletion,
// erase commit with redaction, sweep with its put-back, report, and an
// offboarding that stops between its mark and its report
// (packages/core/src/plane/offboard.ts run); adoption of store records with
// its deferral, erased-id refusal, purge and trust ceiling
// (packages/core/src/plane/adopt.ts adoptStoreItems, write.ts adoptWrite and
// adoptedItem); a write under an erased id (write.ts planeRefusal); and an
// outside party editing a store record (a person editing a memory file).
//
// What is not modelled, and why, is in specs/README.md. This is a model of
// the protocol checked within stated bounds, not a proof of the code.
//
// The constant CHECKED is the conditional append. The module `good` sets it;
// the module `broken` removes it, so a write lands against a stale head, and
// the checker must refute erasureHolds and noWriteWhileErasing there (and
// noStaleAppend, which restates the removed check). The module
// `threeOffboardings` allows a third offboarding, which card E1.5 found the
// code leaked erased content with; card E1.7 closed it (specs/README.md).
module commit {
  const HANDLES: Set[str]
  const ITEMS: Set[str]
  // How many fresh contents (gated writes and outside edits) a run may make.
  const MAX_CONTENT: int
  // How many outside edits of the store a run may make (within MAX_CONTENT).
  const MAX_EDITS: int
  // How many offboardings a run may begin.
  const MAX_OFFBOARDS: int
  // The conditional append (commit.ts staleness under the lock). False in
  // the broken variant.
  const CHECKED: bool

  // ---------------------------------------------------------------- values

  // Provenance kinds as trust ranks, higher more trusted
  // (packages/core/src/policy/promotion.ts TRUST_ORDER: user, document,
  // import, tool, model, ...).
  pure val USER = 3
  pure val IMPORT = 2
  pure val MODEL = 1
  pure val KINDS = Set(USER, MODEL)

  // The content the log keeps for an erased item (offboard.ts REDACTED).
  pure val REDACTED = -2

  // Policy ids, as the code names them.
  pure val GATE_ALLOW = "gate/allow"
  pure val WRITE_CONFLICT = "engram/write/conflict"
  pure val WRITE_ERASED = "engram/write/erased"
  pure val ERASING = "engram/offboard/erasing"
  pure val BEGIN = "engram/offboard/begin"
  pure val REPORT = "engram/offboard/report"
  pure val ERASE = "engram/offboard/erase"
  pure val SWEPT = "engram/offboard/swept"
  pure val ADOPT_ERASED = "engram/adopt/erased"
  pure val ADOPT_WITHDRAWN = "engram/adopt/withdrawn"

  // The denies that count as a change to their item (commit.ts
  // COUNTED_DENIES); a gate's deny changes nothing (P50-4).
  pure val COUNTED_DENIES = Set(WRITE_CONFLICT, ADOPT_ERASED)

  // A store record. `kind` is its provenance as the record claims it, `meta`
  // a field that is neither content nor provenance (a confidence, say), and
  // `ext` marks bytes an outside party wrote, not the plane.
  type StoreRec = { present: bool, content: int, kind: int, meta: int, ext: bool }
  pure val ABSENT: StoreRec = { present: false, content: -1, kind: 0, meta: 0, ext: false }

  // A projected item (items.ts itemById); not live means no item.
  type Item = { live: bool, content: int, kind: int, meta: int }
  pure val NONE: Item = { live: false, content: -1, kind: 0, meta: 0 }

  // The store record the plane writes for an item.
  pure def recOf(it: Item): StoreRec =
    { present: true, content: it.content, kind: it.kind, meta: it.meta, ext: false }

  // One log event (schema.ts MemoryEvent, reduced). `effect` is what the
  // event does to the projection (events.ts applyEvent): set, remove, none.
  type Event = {
    seq: int,
    rule: str,
    decision: str,
    iid: str,
    effect: str,
    content: int,
    kind: int,
    adopted: bool,
    // The head the decision was taken at, for gated writes; -1 otherwise.
    basis: int,
    // The seq of the begin mark a report closes; -1 otherwise.
    closes: int,
    // For an adoption: the kind of the plane's item of that id, -1 if none.
    known: int,
    meta: int,
    // Ghost: the content as appended, never redacted; only the properties
    // read it, so a property can still tell a writer's own adopted bytes
    // after an erasure redacted both events.
    orig: int,
    // Ghosts for an adoption: the kind the record claimed, and the content
    // of the plane's item of that id at the decision (-1 if none).
    claim: int,
    knownContent: int,
    // Ghosts at the append: an offboarding's mark was open by the ghost
    // record of marks (gMarks), and the id was already erased (erasedIds).
    gOpen: bool,
    gErased: bool,
  }

  // A handle's call in progress. One record with a tag; unused fields keep
  // their defaults.
  type Proc = {
    tag: str,
    iid: str,
    content: int,
    kind: int,
    basis: int,
    seen: int,
    desired: Item,
    mend: bool,
    begin: int,
    doomed: Set[str],
    remaining: Set[str],
    listing: str -> StoreRec,
  }

  pure def idleProc(items: Set[str]): Proc = {
    tag: "idle", iid: "", content: -1, kind: 0, basis: -1, seen: -1,
    desired: NONE, mend: false, begin: -1, doomed: Set(), remaining: Set(),
    listing: items.mapBy(_ => ABSENT),
  }

  pure def ev(seq: int, rule: str, decision: str, iid: str, effect: str,
              content: int, kind: int): Event = {
    seq: seq, rule: rule, decision: decision, iid: iid, effect: effect,
    content: content, kind: kind, adopted: false, basis: -1, closes: -1,
    known: -1, meta: 0, orig: content, claim: -1, knownContent: -1,
    gOpen: false, gErased: false,
  }

  pure def minInt(a: int, b: int): int = if (a < b) a else b

  // ------------------------------------------------------- log functions

  // commit.ts logHead: the seq of the last event, -1 for an empty log.
  pure def logHead(l: List[Event]): int = l.length() - 1

  // events.ts applyEvent over the log: the projection (items.ts itemById).
  pure def applyEv(p: str -> Item, e: Event): str -> Item =
    if (e.decision != "allow" or e.iid == "") p
    else if (e.effect == "set") p.set(e.iid, { live: true, content: e.content, kind: e.kind, meta: e.meta })
    else if (e.effect == "remove") p.set(e.iid, NONE)
    else p

  pure def projOf(items: Set[str], l: List[Event]): str -> Item =
    l.foldl(items.mapBy(_ => NONE), (p, e) => applyEv(p, e))

  // The projection of the log's first n events.
  pure def projBefore(items: Set[str], l: List[Event], n: int): str -> Item =
    projOf(items, l.slice(0, n))

  // commit.ts touchedSince: an allowed change to x, or a counted deny, after
  // head h. With ign >= 0, an allowed adoption that recorded exactly the
  // content ign is ignored (commit.ts ownBytes): the writer's own bytes.
  pure def counted(e: Event): bool =
    e.iid != "" and (e.decision == "allow" or COUNTED_DENIES.contains(e.rule))

  pure def touchedSince(l: List[Event], x: str, h: int, ign: int): bool =
    l.foldl(false, (acc, e) =>
      acc or (e.seq > h and e.iid == x and counted(e)
              and not(ign >= 0 and e.adopted and e.decision == "allow" and e.content == ign)))

  // touchedSince over the ghost `orig` content, for the properties only.
  pure def touchedSinceOrig(l: List[Event], x: str, h: int, ign: int): bool =
    l.foldl(false, (acc, e) =>
      acc or (e.seq > h and e.iid == x and counted(e)
              and not(e.adopted and e.decision == "allow" and e.orig == ign)))

  // commit.ts erasureBegunSince.
  pure def erasureBegunSince(l: List[Event], h: int): bool =
    l.foldl(false, (acc, e) => acc or (e.seq > h and e.rule == BEGIN and e.decision == "allow"))

  // commit.ts erasureOpen: a begin opens a mark; a report closes the mark it
  // names and every mark that was open when that one was appended (V-1).
  pure def openMarks(l: List[Event]): Set[int] =
    l.foldl({ open: Set(), at: Map() }, (s, e) =>
      if (e.rule == BEGIN) {
        val o = s.open.union(Set(e.seq))
        { open: o, at: s.at.put(e.seq, o) }
      } else if (e.rule == REPORT) {
        { open: s.open.exclude(s.at.get(e.closes)), at: s.at }
      } else s
    ).open

  pure def erasureOpen(l: List[Event]): bool = openMarks(l).size() > 0

  // commit.ts lastErasure: x was erased at an offboarding.
  pure def erasedIn(l: List[Event], x: str): bool =
    l.foldl(false, (acc, e) => acc or (e.iid == x and e.decision == "allow" and e.rule == ERASE))

  // commit.ts lastRemoval: x was erased or swept.
  pure def removedIn(l: List[Event], x: str): bool =
    l.foldl(false, (acc, e) =>
      acc or (e.iid == x and e.decision == "allow" and (e.rule == ERASE or e.rule == SWEPT)))

  // Some allowed event of the log ever recorded x.
  pure def everAllowed(l: List[Event], x: str): bool =
    l.foldl(false, (acc, e) => acc or (e.iid == x and e.decision == "allow"))

  // A step's name, the handle that took it, and the item it acted on.
  type Step = { name: str, handle: str, iid: str }
  pure def act(name: str, handle: str, iid: str): Step = { name: name, handle: handle, iid: iid }

  // ----------------------------------------------------------------- state

  var log: List[Event]
  var store: str -> StoreRec
  var pc: str -> Proc
  var nextContent: int
  // Ghosts: what the erasures took out, for the properties.
  var erasedIds: Set[str]
  var erasedContent: Set[int]
  // Bound: how many outside edits the run has made.
  var edits: int
  // Ghost: the begin marks still open, kept by the offboardings themselves
  // and not read from the log. A begin adds its own; a report removes its
  // own and every mark begun before it (the marks open when its own was
  // appended, V-1); a stopped offboarding leaves its mark open.
  var gMarks: Set[int]
  // Ghost: the last step taken, so a trace reads as a sequence of steps.
  var lastAction: Step

  val IDLE = idleProc(ITEMS)
  val proj = projOf(ITEMS, log)
  val begins = log.select(e => e.rule == BEGIN).length()

  action init = all {
    log' = List(),
    store' = ITEMS.mapBy(_ => ABSENT),
    pc' = HANDLES.mapBy(_ => IDLE),
    nextContent' = 0,
    erasedIds' = Set(),
    erasedContent' = Set(),
    edits' = 0,
    gMarks' = Set(),
    lastAction' = act("init", "", ""),
  }

  action keepGhosts = all {
    erasedIds' = erasedIds, erasedContent' = erasedContent, edits' = edits, gMarks' = gMarks,
  }

  // The ghost fields of an allowed change appended now to item x.
  def ghosted(e: Event, x: str): Event =
    { ...e, gOpen: gMarks.size() > 0, gErased: erasedIds.contains(x) }

  // ---------------------------------------------------- the gated write

  // write.ts decideWrite and planeRefusal, then appendRefusal: the head is
  // noted, the projection read; a write into a scope being erased is refused
  // (engram/offboard/erasing), as is a new item under an id an offboarding
  // erased or swept (engram/write/erased; card E1.7: a swept id too, which
  // adoption refuses and purges). Otherwise the decision is held with its
  // basis.
  action decide(h: str, x: str, k: int): bool = all {
    pc.get(h).tag == "idle",
    nextContent < MAX_CONTENT,
    val n = log.length()
    if (erasureOpen(log)) all {
      log' = log.append(ev(n, ERASING, "deny", x, "none", -1, k)),
      pc' = pc, nextContent' = nextContent,
    } else if (not(proj.get(x).live) and removedIn(log, x)) all {
      log' = log.append(ev(n, WRITE_ERASED, "deny", x, "none", -1, k)),
      pc' = pc, nextContent' = nextContent,
    } else all {
      log' = log,
      pc' = pc.set(h, { ...IDLE, tag: "decided", iid: x, content: nextContent, kind: k, basis: logHead(log) }),
      nextContent' = nextContent + 1,
    },
    store' = store,
    keepGhosts,
    lastAction' = act("decide", h, x),
  }

  // write.ts decideAndWrite: adapter.write, outside any transaction.
  action storeWrite(h: str): bool = {
    val p = pc.get(h)
    all {
      p.tag == "decided",
      store' = store.set(p.iid, { present: true, content: p.content, kind: p.kind, meta: 0, ext: false }),
      pc' = pc.set(h, { ...p, tag: "wrote" }),
      log' = log, nextContent' = nextContent, keepGhosts,
      lastAction' = act("storeWrite", h, p.iid),
    }
  }

  // write.ts decideAndWrite, the transaction after the store write: the
  // decision must still stand (commit.ts staleness: no counted change to the
  // item since the basis, its own adopted bytes aside, and no offboarding
  // begun since). If it stands, the allow is appended. If not, the writer
  // settles. In the broken variant (CHECKED false) the check is skipped.
  action commit(h: str): bool = {
    val p = pc.get(h)
    val stale = CHECKED and (touchedSince(log, p.iid, p.basis, p.content) or erasureBegunSince(log, p.basis))
    all {
      p.tag == "wrote",
      if (stale) all {
        log' = log,
        pc' = pc.set(h, { ...p, tag: "settling" }),
      } else all {
        log' = log.append(ghosted({ ...ev(log.length(), GATE_ALLOW, "allow", p.iid, "set", p.content, p.kind), basis: p.basis }, p.iid)),
        pc' = pc.set(h, IDLE),
      },
      store' = store, nextContent' = nextContent, keepGhosts,
      lastAction' = act(if (stale) "commitStale" else "commit", h, p.iid),
    }
  }

  // commit.ts settle, the first transaction: what the store should hold now
  // (commit.ts wanted: the projected item unless its scope is being erased),
  // and recovery: an adoption after the basis that recorded this writer's own
  // bytes, with nothing changed since, is withdrawn and the item put back as
  // it stood before it (V-2). The narrowing (V-3) acts on grants, which the
  // model does not carry, so it never applies here, as in the code when the
  // adoption reintroduced no grant.
  action settleRead(h: str): bool = {
    val p = pc.get(h)
    val now = proj.get(p.iid)
    val wantedLive = now.live and not(erasureOpen(log))
    val owns = log.select(e => e.seq > p.basis and e.iid == p.iid and e.adopted
                               and e.decision == "allow" and e.content == p.content)
    val hasOwn = wantedLive and owns.length() > 0
    val own = if (hasOwn) owns[0] else ev(-1, "", "", "", "none", -1, 0)
    val later = log.select(e => e.seq > own.seq and e.iid == p.iid and e.decision == "allow")
    val untouched = hasOwn and later.length() == 0 and now.content == own.content
    val desired = if (untouched) projBefore(ITEMS, log, own.seq).get(p.iid)
                  else if (wantedLive) now
                  else NONE
    all {
      p.tag == "settling",
      pc' = pc.set(h, { ...p, tag: "settleStore", seen: logHead(log), desired: desired, mend: untouched }),
      log' = log, store' = store, nextContent' = nextContent, keepGhosts,
      lastAction' = act("settleRead", h, p.iid),
    }
  }

  // commit.ts settle: the store put back, outside any transaction.
  action settleStore(h: str): bool = {
    val p = pc.get(h)
    all {
      p.tag == "settleStore",
      store' = store.set(p.iid,
        if (p.desired.live) recOf(p.desired)
        else ABSENT),
      pc' = pc.set(h, { ...p, tag: "settleConfirm" }),
      log' = log, nextContent' = nextContent, keepGhosts,
      lastAction' = act("settleStore", h, p.iid),
    }
  }

  // commit.ts settle, the second transaction: if nothing changed the item
  // since the state it wrote was read (and, when it wrote one back, no
  // offboarding began since), the withdrawal (if any) and the deny are
  // appended; otherwise it settles again. The code gives up and throws after
  // SETTLE_ROUNDS (8); the model retries without limit and lacks that path.
  // A withdrawal to nothing is a removal here; the code appends a retire,
  // which leaves the item projected as retired.
  action settleConfirm(h: str): bool = {
    val p = pc.get(h)
    val again = touchedSince(log, p.iid, p.seen, -1) or (p.desired.live and erasureBegunSince(log, p.seen))
    val n = log.length()
    val withdrawal =
      if (p.desired.live)
        ghosted({ ...ev(n, ADOPT_WITHDRAWN, "allow", p.iid, "set", p.desired.content, p.desired.kind), meta: p.desired.meta }, p.iid)
      else ev(n, ADOPT_WITHDRAWN, "allow", p.iid, "remove", -1, 0)
    val deny = ev(if (p.mend) n + 1 else n, WRITE_CONFLICT, "deny", p.iid, "none", -1, p.kind)
    all {
      p.tag == "settleConfirm",
      if (again) all {
        log' = log,
        pc' = pc.set(h, { ...p, tag: "settling" }),
      } else all {
        log' = if (p.mend) log.append(withdrawal).append(deny) else log.append(deny),
        pc' = pc.set(h, IDLE),
      },
      store' = store, nextContent' = nextContent, keepGhosts,
      lastAction' = act(if (again) "settleAgain" else "settleDeny", h, p.iid),
    }
  }

  // ---------------------------------------------------------- offboarding

  // offboard.ts run, the mark: what will be erased is read and the begin
  // mark appended in one transaction, before any store record is deleted.
  action obBegin(h: str): bool = all {
    pc.get(h).tag == "idle",
    begins < MAX_OFFBOARDS,
    val doomed = ITEMS.filter(x => proj.get(x).live)
    all {
      log' = log.append(ev(log.length(), BEGIN, "allow", "", "none", -1, 0)),
      pc' = pc.set(h, { ...IDLE, tag: "obDelete", begin: log.length(), doomed: doomed, remaining: doomed }),
      gMarks' = gMarks.union(Set(log.length())),
    },
    store' = store, nextContent' = nextContent,
    erasedIds' = erasedIds, erasedContent' = erasedContent, edits' = edits,
    lastAction' = act("obBegin", h, ""),
  }

  // offboard.ts run: each doomed ref deleted from the store, one store call
  // each, outside any transaction.
  action obDelete(h: str, x: str): bool = {
    val p = pc.get(h)
    all {
      p.tag == "obDelete",
      p.remaining.contains(x),
      store' = store.set(x, ABSENT),
      pc' = pc.set(h, { ...p, remaining: p.remaining.exclude(Set(x)) }),
      log' = log, nextContent' = nextContent, keepGhosts,
      lastAction' = act("obDelete", h, x),
    }
  }

  // offboard.ts run, the erasure transaction: what the mark read and the
  // projection still holds is erased; every event about it is redacted
  // (offboard.ts redacted); one erase event per item removes it.
  action obErase(h: str): bool = {
    val p = pc.get(h)
    val erased = p.doomed.filter(x => proj.get(x).live)
    val contents = log.select(e => erased.contains(e.iid) and e.content >= 0)
                      .foldl(Set(), (s, e) => s.union(Set(e.content)))
    val redactedLog = log.foldl(List(), (l, e) =>
      l.append(if (erased.contains(e.iid) and e.content >= 0) { ...e, content: REDACTED } else e))
    all {
      p.tag == "obDelete",
      p.remaining == Set(),
      log' = erased.fold(redactedLog, (l, x) => l.append(ev(l.length(), ERASE, "allow", x, "remove", -1, 0))),
      erasedIds' = erasedIds.union(erased),
      erasedContent' = erasedContent.union(contents),
      edits' = edits, gMarks' = gMarks,
      pc' = pc.set(h, { ...p, tag: "obSweepList" }),
      store' = store, nextContent' = nextContent,
      lastAction' = act("obErase", h, ""),
    }
  }

  // offboard.ts run, the sweep: the head noted, then the store listed.
  action obSweepList(h: str): bool = {
    val p = pc.get(h)
    all {
      p.tag == "obSweepList",
      pc' = pc.set(h, { ...p, tag: "obSweep", seen: logHead(log),
                        remaining: ITEMS.filter(x => store.get(x).present) }),
      log' = log, store' = store, nextContent' = nextContent, keepGhosts,
      lastAction' = act("obSweepList", h, ""),
    }
  }

  // offboard.ts run, the sweep's decision on one listed record, under the
  // lock: a record no projected item holds, under an erased id or one no
  // allowed event ever recorded, is to be deleted; anything else stays.
  action obSweepDecide(h: str, x: str): bool = {
    val p = pc.get(h)
    val sweep = not(proj.get(x).live) and (erasedIn(log, x) or not(everAllowed(log, x)))
    all {
      p.tag == "obSweep",
      p.remaining.contains(x),
      pc' = pc.set(h, if (sweep) { ...p, tag: "obSweepDel", iid: x }
                      else { ...p, remaining: p.remaining.exclude(Set(x)) }),
      log' = log, store' = store, nextContent' = nextContent, keepGhosts,
      lastAction' = act(if (sweep) "obSweepDecide" else "obSweepKeep", h, x),
    }
  }

  // offboard.ts run: the sweep's store delete, outside any transaction.
  action obSweepDel(h: str): bool = {
    val p = pc.get(h)
    all {
      p.tag == "obSweepDel",
      store' = store.set(p.iid, ABSENT),
      pc' = pc.set(h, { ...p, tag: "obSweepCommit" }),
      log' = log, nextContent' = nextContent, keepGhosts,
      lastAction' = act("obSweepDel", h, p.iid),
    }
  }

  // offboard.ts run: the swept event, appended only if the record's item did
  // not change since the sweep's head (V3-2); otherwise the projected item is
  // put back.
  action obSweepCommit(h: str): bool = {
    val p = pc.get(h)
    val changed = touchedSince(log, p.iid, p.seen, -1)
    all {
      p.tag == "obSweepCommit",
      if (changed) all {
        log' = log,
        pc' = pc.set(h, { ...p, tag: "obPutBackRead" }),
      } else all {
        log' = log.append(ev(log.length(), SWEPT, "allow", p.iid, "remove", -1, 0)),
        pc' = pc.set(h, { ...p, tag: "obSweep", remaining: p.remaining.exclude(Set(p.iid)) }),
      },
      store' = store, nextContent' = nextContent, keepGhosts,
      lastAction' = act(if (changed) "obSweepChanged" else "obSwept", h, p.iid),
    }
  }

  // offboard.ts run, the put-back loop: read the head and the item under
  // the lock, and what the store should hold, as settle's `wanted` has it
  // (commit.ts): the projected item unless it is gone or its scope is being
  // erased, in which case nothing; write it back or delete the record; check
  // again. Card E1.7: before it, a read that found the item gone ended the
  // loop and left what the last round wrote, which a third offboarding could
  // have erased in between (module threeOffboardings). The code stops after
  // four rounds; the model retries without limit and lacks that path.
  action obPutBackRead(h: str): bool = {
    val p = pc.get(h)
    val now = proj.get(p.iid)
    val keep = now.live and not(erasureOpen(log))
    all {
      p.tag == "obPutBackRead",
      pc' = pc.set(h, { ...p, tag: "obPutBackWrite", basis: logHead(log), desired: if (keep) now else NONE }),
      log' = log, store' = store, nextContent' = nextContent, keepGhosts,
      lastAction' = act("obPutBackRead", h, p.iid),
    }
  }

  action obPutBackWrite(h: str): bool = {
    val p = pc.get(h)
    all {
      p.tag == "obPutBackWrite",
      store' = store.set(p.iid, if (p.desired.live) recOf(p.desired) else ABSENT),
      pc' = pc.set(h, { ...p, tag: "obPutBackCheck" }),
      log' = log, nextContent' = nextContent, keepGhosts,
      lastAction' = act("obPutBackWrite", h, p.iid),
    }
  }

  action obPutBackCheck(h: str): bool = {
    val p = pc.get(h)
    val changed = touchedSince(log, p.iid, p.basis, -1)
    all {
      p.tag == "obPutBackCheck",
      pc' = pc.set(h, if (changed) { ...p, tag: "obPutBackRead" }
                      else { ...p, tag: "obSweep", remaining: p.remaining.exclude(Set(p.iid)) }),
      log' = log, store' = store, nextContent' = nextContent, keepGhosts,
      lastAction' = act("obPutBackCheck", h, p.iid),
    }
  }

  // offboard.ts run: the report, closing this offboarding's mark and every
  // mark open when it was appended (commit.ts closesClause, V-1).
  action obReport(h: str): bool = {
    val p = pc.get(h)
    all {
      p.tag == "obSweep",
      p.remaining == Set(),
      log' = log.append({ ...ev(log.length(), REPORT, "allow", "", "none", -1, 0), closes: p.begin }),
      pc' = pc.set(h, IDLE),
      gMarks' = gMarks.filter(m => m > p.begin),
      store' = store, nextContent' = nextContent,
      erasedIds' = erasedIds, erasedContent' = erasedContent, edits' = edits,
      lastAction' = act("obReport", h, ""),
    }
  }

  // An offboarding that stops after its mark (a crash, a handover's store
  // failure): the scope stays frozen until a later report closes the mark.
  action obStop(h: str): bool = {
    val p = pc.get(h)
    all {
      Set("obDelete", "obSweepList", "obSweep", "obSweepDel", "obSweepCommit",
          "obPutBackRead", "obPutBackWrite", "obPutBackCheck").contains(p.tag),
      pc' = pc.set(h, IDLE),
      log' = log, store' = store, nextContent' = nextContent, keepGhosts,
      lastAction' = act("obStop", h, ""),
    }
  }

  // ------------------------------------------------------------- adoption

  // adopt.ts adoptStoreItems: the head noted before the store is listed.
  action adoptList(h: str): bool = all {
    pc.get(h).tag == "idle",
    pc' = pc.set(h, { ...IDLE, tag: "adopt", seen: logHead(log), listing: store,
                      remaining: ITEMS.filter(x => store.get(x).present) }),
    log' = log, store' = store, nextContent' = nextContent, keepGhosts,
    lastAction' = act("adoptList", h, ""),
  }

  // adopt.ts adoptStoreItems and write.ts adoptWrite, one listed record, one
  // transaction: skipped when the projection holds it as listed; left to the
  // next adoption when the log changed it, or began an erasure, since the
  // listing; refused and purged under an erased or swept id the projection
  // does not hold (engram/adopt/erased, adopt.ts erasedRefusal); refused while
  // the scope is being erased; otherwise adopted (adoptedItem): a record whose
  // content and provenance are as the plane holds them for the id keeps the
  // plane's provenance (asHeld), any other takes the least trusted of its
  // claim, the plane's kind for the id, and import. It is unchanged when the
  // projection holds exactly what adoption would record (adopt.ts compares
  // the adopted item, not the raw record).
  action adoptOne(h: str, x: str): bool = {
    val p = pc.get(h)
    val rec = p.listing.get(x)
    val known = proj.get(x)
    val asHeld = known.live and rec.content == known.content and rec.kind == known.kind
    val kind = if (asHeld) known.kind
               else minInt(minInt(rec.kind, if (known.live) known.kind else IMPORT), IMPORT)
    val unchanged = known.live and known.content == rec.content and known.meta == rec.meta
                    and known.kind == kind
    val deferred = touchedSince(log, x, p.seen, -1) or erasureBegunSince(log, p.seen)
    val refusedErased = not(known.live) and removedIn(log, x)
    val refusedErasing = erasureOpen(log)
    val n = log.length()
    val advanced = { ...p, remaining: p.remaining.exclude(Set(x)) }
    all {
      p.tag == "adopt",
      p.remaining.contains(x),
      if (unchanged or deferred) all {
        log' = log, pc' = pc.set(h, advanced),
      } else if (refusedErased) all {
        log' = log.append({ ...ev(n, ADOPT_ERASED, "deny", x, "none", -1, rec.kind), adopted: true }),
        pc' = pc.set(h, { ...advanced, tag: "adoptPurge", iid: x }),
      } else if (refusedErasing) all {
        log' = log.append({ ...ev(n, ERASING, "deny", x, "none", -1, rec.kind), adopted: true }),
        pc' = pc.set(h, advanced),
      } else all {
        log' = log.append(ghosted({ ...ev(n, GATE_ALLOW, "allow", x, "set", rec.content, kind), adopted: true,
                                    meta: rec.meta, claim: rec.kind,
                                    known: if (known.live) known.kind else -1,
                                    knownContent: if (known.live) known.content else -1 }, x)),
        pc' = pc.set(h, advanced),
      },
      store' = store, nextContent' = nextContent, keepGhosts,
      lastAction' = act(if (unchanged) "adoptSkip"
                        else if (deferred) "adoptDefer"
                        else if (refusedErased) "adoptRefuseErased"
                        else if (refusedErasing) "adoptRefuseErasing"
                        else "adopt", h, x),
    }
  }

  // adopt.ts purgeOutcome: the refused record deleted, after the deny is
  // committed, outside any transaction.
  action adoptPurge(h: str): bool = {
    val p = pc.get(h)
    all {
      p.tag == "adoptPurge",
      store' = store.set(p.iid, ABSENT),
      pc' = pc.set(h, { ...p, tag: "adopt" }),
      log' = log, nextContent' = nextContent, keepGhosts,
      lastAction' = act("adoptPurge", h, p.iid),
    }
  }

  action adoptDone(h: str): bool = {
    val p = pc.get(h)
    all {
      p.tag == "adopt",
      p.remaining == Set(),
      pc' = pc.set(h, IDLE),
      log' = log, store' = store, nextContent' = nextContent, keepGhosts,
      lastAction' = act("adoptDone", h, ""),
    }
  }

  // -------------------------------------------------------- outside party

  // A person edits or drops a record in the store outside the plane (a
  // memory file written by hand), claiming any kind. It writes fresh content:
  // a copy of erased content under a new id is ADR 0010's open question.
  action outsideEdit(x: str, k: int): bool = all {
    nextContent < MAX_CONTENT,
    edits < MAX_EDITS,
    store' = store.set(x, { present: true, content: nextContent, kind: k, meta: 0, ext: true }),
    nextContent' = nextContent + 1,
    log' = log, pc' = pc,
    erasedIds' = erasedIds, erasedContent' = erasedContent, edits' = edits + 1, gMarks' = gMarks,
    lastAction' = act("outsideEdit", "", x),
  }

  // A person edits only a record's non-content field (its confidence), so
  // its content and provenance stay as the plane holds them.
  action outsideEditMeta(x: str): bool = all {
    store.get(x).present,
    edits < MAX_EDITS,
    store' = store.set(x, { ...store.get(x), meta: edits + 1, ext: true }),
    nextContent' = nextContent,
    log' = log, pc' = pc,
    erasedIds' = erasedIds, erasedContent' = erasedContent, edits' = edits + 1, gMarks' = gMarks,
    lastAction' = act("outsideEditMeta", "", x),
  }

  // ----------------------------------------------------------------- step

  action step = {
    nondet h = HANDLES.oneOf()
    nondet x = ITEMS.oneOf()
    nondet k = KINDS.oneOf()
    any {
      decide(h, x, k),
      storeWrite(h),
      commit(h),
      settleRead(h),
      settleStore(h),
      settleConfirm(h),
      obBegin(h),
      obDelete(h, x),
      obErase(h),
      obSweepList(h),
      obSweepDecide(h, x),
      obSweepDel(h),
      obSweepCommit(h),
      obPutBackRead(h),
      obPutBackWrite(h),
      obPutBackCheck(h),
      obReport(h),
      obStop(h),
      adoptList(h),
      adoptOne(h, x),
      adoptPurge(h),
      adoptDone(h),
      outsideEdit(x, k),
      outsideEditMeta(x),
    }
  }

  // ------------------------------------------------------- the properties

  // Property 1. No event is appended against a stale head: every gated
  // write's allow was appended with no counted change to its item between
  // its basis and its append (its own adopted bytes aside), and no
  // offboarding begun in that window.
  val noStaleAppend =
    log.select(e => e.rule == GATE_ALLOW and not(e.adopted) and e.decision == "allow")
      .foldl(true, (ok, e) => ok and {
        val window = log.slice(0, e.seq)
        not(touchedSinceOrig(window, e.iid, e.basis, e.orig)) and not(erasureBegunSince(window, e.basis))
      })

  // Property 2. An erased item's content appears in no later state: no event
  // of the log and no projected item holds erased content, no projected item
  // holds an erased id, and the store holds a record under an erased id, or
  // holding erased content, only while a call that will remove it is in
  // flight (a stale writer settling, an adoption's purge, a sweep's delete,
  // a sweep's put-back, which since card E1.7 deletes what it wrote once the
  // item is gone), or when an outside party wrote it there.
  def inFlightOn(x: str): bool =
    HANDLES.exists(h => {
      val p = pc.get(h)
      p.iid == x and Set("wrote", "settling", "settleStore", "settleConfirm",
                          "adoptPurge", "obSweepDel", "obPutBackRead", "obPutBackWrite",
                          "obPutBackCheck").contains(p.tag)
    })

  val erasureHolds =
    log.foldl(true, (ok, e) => ok and not(erasedContent.contains(e.content)))
    and ITEMS.forall(x => {
      val it = proj.get(x)
      not(it.live and (erasedIds.contains(x) or erasedContent.contains(it.content)))
    })
    and ITEMS.forall(x => {
      val r = store.get(x)
      (r.present and (erasedIds.contains(x) or erasedContent.contains(r.content)))
        implies (r.ext or inFlightOn(x))
    })

  // Property 3. An offboarded scope accepts no later write: no allowed write,
  // adoption or withdrawal into the person scope is appended while a mark is
  // open by the offboardings' own ghost record (gMarks), and none under an
  // id an erasure took out (erasedIds). It reads no log function the guards
  // use. (A write under a fresh id after the report is accepted, ADR 0010's
  // open question, and so is not a violation; and a later report closes an
  // earlier mark by design, V-1, so a write is accepted while the earlier
  // offboarding is still deleting and sweeping.)
  val noWriteWhileErasing =
    log.select(e => e.decision == "allow" and e.effect == "set")
      .foldl(true, (ok, e) => ok and not(e.gOpen) and not(e.gErased))

  // Property 4. Adoption never raises trust (AGENTS.md invariant 6): every
  // adoption records a kind no more trusted than the record's claim and
  // than the plane's kind for the id, and no more trusted than import
  // unless the record's content and provenance are as the plane holds them
  // (write.ts adoptedItem, asHeld); and every projected item more trusted
  // than import is backed by a gated write of its content at that kind or
  // above.
  val adoptionNeverRaisesTrust =
    log.select(e => e.adopted and e.decision == "allow")
      .foldl(true, (ok, e) => ok and e.kind <= e.claim and (e.known < 0 or e.kind <= e.known)
        and (e.kind <= IMPORT or (e.known >= 0 and e.orig == e.knownContent and e.claim == e.known)))
    and ITEMS.forall(x => {
      val it = proj.get(x)
      (it.live and it.kind > IMPORT) implies
        log.foldl(false, (acc, e) => acc or (e.rule == GATE_ALLOW and not(e.adopted) and e.decision == "allow"
                                            and e.content == it.content and e.kind >= it.kind))
    })

  val safety = noStaleAppend and erasureHolds and noWriteWhileErasing and adoptionNeverRaisesTrust

  // ---------------------------------------------------------- witnesses
  // Each is true in a state the races of card E2.6 pass through; `quint run
  // --witnesses` counts the traces that reach one, so a passing run shows it
  // reached the cases the properties are about.
  def logHas(rule: str): bool = log.foldl(false, (acc, e) => acc or e.rule == rule)
  def tagged(tag: str): bool = HANDLES.exists(h => pc.get(h).tag == tag)

  // A stale writer refused and its store put back (commit.ts settle).
  val sawConflict = logHas(WRITE_CONFLICT)
  // An adoption of a stale writer's own bytes withdrawn (P50-1, V-2).
  val sawWithdrawal = logHas(ADOPT_WITHDRAWN)
  // An erasure committed while a writer of the erased id was in flight.
  val sawWriterAcrossErasure =
    erasedIds.exists(x => HANDLES.exists(h => pc.get(h).iid == x and
      Set("wrote", "settling", "settleStore", "settleConfirm").contains(pc.get(h).tag)))
  // The sweep deleted a record (V-1, V-5).
  val sawSwept = logHas(SWEPT)
  // The sweep found its item changed and put it back (V3-2).
  val sawPutBack = tagged("obPutBackWrite")
  // Adoption refused and purged a record under an erased or swept id (P50-2).
  val sawAdoptErased = logHas(ADOPT_ERASED)
  // A write under an erased id refused (engram/write/erased).
  val sawWriteErased = logHas(WRITE_ERASED)
  // A write refused because its scope is being erased.
  val sawErasing = logHas(ERASING)
  // A report closed a mark other than the one its own offboarding appended:
  // a rerun after a stopped offboarding, or an overlap (V-1).
  val sawReopen =
    log.foldl(false, (acc, e) => acc or (e.rule == REPORT and openMarks(log.slice(0, e.seq)).size() > 1))
  // An adoption that kept the plane's provenance above import (asHeld).
  val sawAsHeldAboveImport =
    log.foldl(false, (acc, e) => acc or (e.adopted and e.decision == "allow" and e.kind > IMPORT))
  // An adoption over an item the plane holds at user trust.
  val sawAdoptionOverUser =
    log.foldl(false, (acc, e) => acc or (e.adopted and e.decision == "allow" and e.known == USER))
}

// The protocol as card E2.6 built it.
module good {
  import commit(
    HANDLES = Set("h1", "h2", "h3"),
    ITEMS = Set("a", "b"),
    MAX_CONTENT = 6,
    MAX_EDITS = 2,
    MAX_OFFBOARDS = 2,
    CHECKED = true
  ).*

  // Scenario tests (quint test): fixed interleavings of the races card
  // E2.6's review rounds found, each ending in the state the code reaches.

  // A committed write of a, then the offboarding's mark, its delete and its
  // erase, all inside h1's rewrite of a, decided before the mark (orderings
  // R1, R3): the rewrite finds the mark under the lock and deletes its bytes.
  run staleWriteAcrossErasureTest =
    init
      .then(decide("h1", "a", USER)).then(storeWrite("h1")).then(commit("h1"))
      .then(decide("h1", "a", USER)).then(storeWrite("h1"))
      .then(obBegin("h2")).then(obDelete("h2", "a")).then(obErase("h2"))
      .then(commit("h1"))
      .expect(pc.get("h1").tag == "settling")
      .then(settleRead("h1"))
      .then(settleStore("h1")).then(settleConfirm("h1"))
      .expect(all {
        store.get("a") == ABSENT,
        erasedIds == Set("a"),
        log[log.length() - 1].rule == WRITE_CONFLICT,
        safety,
      })

  // After a completed offboarding, a write under the erased id is refused.
  run writeAfterEraseTest =
    init
      .then(decide("h1", "a", USER)).then(storeWrite("h1")).then(commit("h1"))
      .then(obBegin("h2")).then(obDelete("h2", "a")).then(obErase("h2"))
      .then(obSweepList("h2")).then(obReport("h2"))
      .then(decide("h3", "a", USER))
      .expect(all {
        log[log.length() - 1].rule == WRITE_ERASED,
        pc.get("h3").tag == "idle",
        not(proj.get("a").live),
        safety,
      })

  // An adoption records a writer's bytes before the writer commits (P50-1):
  // the writer's check ignores its own adopted bytes and commits at its own
  // kind; the adoption recorded them at import, never above.
  run ownBytesAdoptedTest =
    init
      .then(decide("h1", "a", USER)).then(storeWrite("h1"))
      .then(adoptList("h2")).then(adoptOne("h2", "a")).then(adoptDone("h2"))
      .then(commit("h1"))
      .expect(all {
        log[0].adopted and log[0].kind == IMPORT,
        log[1].rule == GATE_ALLOW and not(log[1].adopted),
        proj.get("a").kind == USER,
        safety,
      })

  // A stale writer's bytes adopted after another handle committed (V-2):
  // settling withdraws the adoption and puts back what the other handle wrote.
  run withdrawalTest =
    init
      .then(decide("h1", "a", USER)).then(storeWrite("h1")).then(commit("h1"))
      .then(decide("h1", "a", MODEL)).then(decide("h2", "a", USER))
      .then(storeWrite("h2")).then(commit("h2"))
      .then(storeWrite("h1"))
      .then(adoptList("h3")).then(adoptOne("h3", "a")).then(adoptDone("h3"))
      .then(commit("h1")).then(settleRead("h1"))
      .expect(pc.get("h1").mend)
      .then(settleStore("h1")).then(settleConfirm("h1"))
      .expect(all {
        proj.get("a").content == 2,
        proj.get("a").kind == USER,
        store.get("a").content == 2,
        log.select(e => e.rule == ADOPT_WITHDRAWN).length() == 1,
        safety,
      })

  // Two offboardings overlap and the later report closes both marks, so the
  // owner writes b while the earlier one still sweeps (V3-2): its sweep finds
  // b changed under the lock and puts the owner's record back.
  run sweepPutBackTest =
    init
      .then(decide("h3", "b", USER))
      .then(obBegin("h1")).then(obBegin("h2"))
      .then(obErase("h2")).then(obSweepList("h2")).then(obReport("h2"))
      .then(storeWrite("h3")).then(commit("h3"))
      .then(obErase("h1")).then(obSweepList("h1")).then(obSweepDecide("h1", "b"))
      .then(decide("h2", "b", USER)).then(storeWrite("h2")).then(commit("h2"))
      .then(obSweepDel("h1")).then(obSweepCommit("h1"))
      .expect(pc.get("h1").tag == "obPutBackRead")
      .then(obPutBackRead("h1")).then(obPutBackWrite("h1")).then(obPutBackCheck("h1"))
      .then(obReport("h1"))
      .then(settleRead("h3")).then(settleStore("h3")).then(settleConfirm("h3"))
      .expect(all {
        proj.get("b").live and proj.get("b").content == 1,
        store.get("b").content == 1,
        log.select(e => e.rule == SWEPT).length() == 0,
        safety,
      })

  // A record whose content and provenance are as the plane holds them, with
  // only its confidence edited by hand, is adopted at the plane's own kind,
  // user, above import (write.ts adoptedItem, asHeld; E1.5-2): property 4
  // allows exactly this.
  run asHeldKeepsTrustTest =
    init
      .then(decide("h1", "a", USER)).then(storeWrite("h1")).then(commit("h1"))
      .then(outsideEditMeta("a"))
      .then(adoptList("h2")).then(adoptOne("h2", "a")).then(adoptDone("h2"))
      .expect(all {
        log[1].adopted and log[1].decision == "allow" and log[1].kind == USER,
        proj.get("a").meta == 1,
        adoptionNeverRaisesTrust,
        safety,
      })
      .then(adoptList("h2")).then(adoptOne("h2", "a"))
      .expect(lastAction.name == "adoptSkip")

  // Card E1.5 found a race here (log entry 2026-11-21-e1-5-finding-purge-
  // race-on-the-code): a write under a swept id was allowed (planeRefusal
  // checked lastErasure only), adoption refuses that id and deletes its
  // record after the refusal (purgeOutcome), so a write committed between
  // the two lost its store record. Card E1.7 refuses a new write under a
  // swept id as under an erased one, and rechecks under the lock before each
  // purge: the write is refused, the purge deletes the record dropped in by
  // hand, and nothing the plane holds loses its record.
  run sweptIdPurgeRaceTest =
    init
      .then(decide("h1", "b", USER))
      .then(obBegin("h2")).then(storeWrite("h1")).then(commit("h1"))
      .then(obErase("h2")).then(obSweepList("h2")).then(obSweepDecide("h2", "b"))
      .then(obSweepDel("h2")).then(obSweepCommit("h2")).then(obReport("h2"))
      .then(settleRead("h1")).then(settleStore("h1")).then(settleConfirm("h1"))
      .then(outsideEdit("b", USER))
      .then(adoptList("h3")).then(adoptOne("h3", "b"))
      .expect(pc.get("h3").tag == "adoptPurge")
      .then(decide("h2", "b", USER))
      .expect(all {
        log[log.length() - 1].rule == WRITE_ERASED,
        pc.get("h2").tag == "idle",
      })
      .then(adoptPurge("h3"))
      .expect(all {
        not(proj.get("b").live),
        not(store.get("b").present),
        safety,
      })
}

// The conditional append removed: a write lands against a stale head.
module broken {
  import commit(
    HANDLES = Set("h1", "h2", "h3"),
    ITEMS = Set("a", "b"),
    MAX_CONTENT = 6,
    MAX_EDITS = 2,
    MAX_OFFBOARDS = 2,
    CHECKED = false
  ).*

  // The shortest refutation: a write decided before the mark commits after
  // it, against a stale head, into a scope being erased.
  run staleAppendTest =
    init
      .then(decide("h1", "a", USER)).then(storeWrite("h1"))
      .then(obBegin("h2"))
      .then(commit("h1"))
      .expect(all { not(noStaleAppend), not(noWriteWhileErasing) })

  // Without the check, a rewrite decided before the mark brings an erased
  // id back after the erasure: erasureHolds fails.
  run erasedIdBackTest =
    init
      .then(decide("h1", "a", USER)).then(storeWrite("h1")).then(commit("h1"))
      .then(decide("h1", "a", USER))
      .then(obBegin("h2")).then(obDelete("h2", "a")).then(obErase("h2"))
      .then(storeWrite("h1")).then(commit("h1"))
      .expect(all { not(erasureHolds), not(noWriteWhileErasing), not(noStaleAppend) })
}

// Three offboardings of one person. Card E1.5 found a leak here (log entry
// 2026-11-21-e1-5-finding-put-back-leak): the sweep's put-back (offboard.ts
// run, the loop after a changed swept record) reads the item, a third
// offboarding erases it, and the put-back writes it back; on the next round
// the item was gone and the loop ended without deleting what it wrote, so
// after both reports the store held erased content. The `good` module bounds
// offboardings at two, which hid it. Card E1.7 made the put-back delete the
// record when the item is gone or its scope is being erased, as settle's
// `wanted` does (obPutBackRead): the same interleaving now ends with the
// record deleted and every property holding.
module threeOffboardings {
  import commit(
    HANDLES = Set("h1", "h2", "h3"),
    ITEMS = Set("a", "b"),
    MAX_CONTENT = 6,
    MAX_EDITS = 2,
    MAX_OFFBOARDS = 3,
    CHECKED = true
  ).*

  run putBackAcrossThirdErasureTest =
    init
      .then(decide("h3", "b", USER))
      .then(obBegin("h1")).then(obBegin("h2"))
      .then(obErase("h2")).then(obSweepList("h2")).then(obReport("h2"))
      .then(storeWrite("h3")).then(commit("h3"))
      .then(obErase("h1")).then(obSweepList("h1")).then(obSweepDecide("h1", "b"))
      .then(settleRead("h3")).then(settleStore("h3")).then(settleConfirm("h3"))
      .then(decide("h2", "b", USER)).then(storeWrite("h2")).then(commit("h2"))
      .expect(proj.get("b").live)
      .then(obSweepDel("h1")).then(obSweepCommit("h1"))
      .expect(pc.get("h1").tag == "obPutBackRead")
      .then(obPutBackRead("h1"))
      .then(obBegin("h2")).then(obDelete("h2", "b")).then(obErase("h2")).then(obSweepList("h2"))
      .then(obPutBackWrite("h1"))
      .expect(all {
        store.get("b").present,
        erasedContent.contains(store.get("b").content),
        safety,
      })
      .then(obPutBackCheck("h1")).then(obPutBackRead("h1"))
      .expect(not(pc.get("h1").desired.live))
      .then(obPutBackWrite("h1")).then(obPutBackCheck("h1"))
      .then(obReport("h2"))
      .then(obReport("h1"))
      .expect(all {
        erasedIds.contains("b"),
        not(store.get("b").present),
        HANDLES.forall(h => pc.get(h).tag == "idle"),
        safety,
      })
}
