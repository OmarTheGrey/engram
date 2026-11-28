# specs: a checked model of the commit and erasure protocol

`specs/commit.qnt` is a [Quint](https://github.com/informalsystems/quint) model of the protocol card E2.6 built: several handles (processes) over one event log and one store, each deciding at the log's head and appending conditionally, with offboarding's mark, erasure and sweep, adoption, and a write after an erasure (card E1.5). `make verify-spec` checks it. It runs outside `make test`.

Part of the Engram repository; start at the [root README](../README.md).

This is bounded checking of a model, not a proof of the code. The model is written by hand from `packages/core/src/plane/` and can drift from it; each transition names, in a comment, the function and file it models.

## What is modelled

One person scope holding two item ids, three handles, and an outside party that edits store records by hand. Every step that reads or appends the log is one transaction under the log's lock (ADR 0024); every store call is a step of its own, so another handle may move between it and the transaction that follows. A store record carries its content, the provenance kind it claims, and one field that is neither (`meta`, standing for a confidence).

| transition | models |
|---|---|
| `decide` | `write.ts` `decideWrite`, `planeRefusal`, `appendRefusal`: the head noted, the projection read; refused while the scope is being erased (`engram/offboard/erasing`) or for a new item under an id an offboarding erased or swept (`engram/write/erased`) |
| `storeWrite` | `write.ts` `decideAndWrite`: `adapter.write` |
| `commit` | `write.ts` `decideAndWrite`, `commit.ts` `staleness` and `ownBytes`: the conditional append |
| `settleRead`, `settleStore`, `settleConfirm` | `commit.ts` `settle`, `wanted`, `recovery`: the stale writer puts the store back, withdraws an adoption of its own bytes (V-2), and appends its deny (`engram/write/conflict`) |
| `obBegin` | `offboard.ts` `run`: the begin mark, appended with the read of what will be erased |
| `obDelete`, `obErase` | `offboard.ts` `run`: the store deletes, then the erase events and the redaction of every earlier copy |
| `obSweepList`, `obSweepDecide`, `obSweepDel`, `obSweepCommit`, `obPutBack*` | `offboard.ts` `run`: the sweep, its check under the lock, and its put-back (V-1, V-5, V3-2), which writes back the projected item or, when it is gone or its scope is being erased, deletes the record (card E1.7) |
| `obReport` | `offboard.ts` `run`, `commit.ts` `erasureOpen`: the report closes its mark and every mark open when that one was appended (V-1) |
| `obStop` | an offboarding that stops after its mark (a crash, a handover's store failure) |
| `adoptList`, `adoptOne`, `adoptPurge`, `adoptDone` | `adopt.ts` `adoptStoreItems`, `erasedRefusal`, `purgeOutcome`; `write.ts` `adoptWrite`, `adoptedItem`: the listing's head, the deferral, the erased-id refusal and purge (the purge's check under the lock, card E1.7, runs in the code in the same synchronous stretch as the refusal, so `adoptOne` holds both; a purge an earlier adoption decided is `adoptOne`'s deferral or its refusal again), the kind adoption records (the plane's own when the record's content and provenance are as the plane holds them, `asHeld`; otherwise the least trusted of the claim, the plane's kind and import) |
| `outsideEdit`, `outsideEditMeta` | a person writing a memory file by hand, claiming any kind; or editing only its confidence |

## The four safety properties

1. `noStaleAppend`. No event is appended against a stale head: every gated write's allow has no counted change to its item (`commit.ts` `touchedSince`, its own adopted bytes aside) and no offboarding begun between its basis and its append. It restates the conditional append, so it is the weakest evidence of the four.
2. `erasureHolds`. An erased item's content appears in no later state: no log event and no projected item holds erased content, no projected item holds an erased id, and the store holds a record under an erased id, or holding erased content, only while a call that will remove it is in flight (a stale writer settling, an adoption's purge, a sweep's delete, or a sweep's put-back, which since card E1.7 deletes what it wrote once the item is gone), or when an outside party wrote it.
3. `noWriteWhileErasing`. An offboarded scope accepts no later write: no allowed write, adoption or withdrawal into the person scope while a begin mark is open, and none under an erased id ever. Both are judged on ghost state, not on the log functions the guards use: each offboarding keeps its own record of the marks it opened (`gMarks`; a report removes its own mark and every mark begun before it), and `erasedIds` holds what the erasures took out. Two behaviours are accepted by design and so are not counted. A write under a fresh id after the report is accepted, as the code accepts it (ADR 0010's first open question). And a later offboarding's report closes an earlier offboarding's mark (V-1), so a write is accepted while that earlier offboarding is still deleting and sweeping.
4. `adoptionNeverRaisesTrust`, as AGENTS.md's invariant 6 states it. Every adoption records a kind no more trusted than the record's claim and than the plane's kind for the id, and no more trusted than import unless the record's content and provenance are as the plane holds them (`adoptedItem`'s `asHeld`, where the plane keeps its own provenance: a record whose confidence alone was edited by hand is adopted at `user`, which `asHeldKeepsTrustTest` pins). And every projected item more trusted than import is backed by a gated write of its content at that kind or above.

`safety` is their conjunction.

## The broken variant

The module `broken` sets `CHECKED = false`: the conditional append is removed, so `commit` appends whatever the head now holds. `make verify-spec` requires the simulator to refute `erasureHolds` and `noWriteWhileErasing` there, and `noStaleAppend` as an extra, and exits non-zero if any one is not refuted. Its scenario tests pin two refutations: `staleAppendTest` (the shortest, 4 steps) and `erasedIdBackTest` (a rewrite decided before the mark brings an erased id back, 9 steps).

The simulator's counterexample to `erasureHolds` (seed 1, `.engram/verify-spec/broken-simulation-erasureHolds.itf.json`), its irrelevant steps left out:

```
 2 outsideEdit(a)       a record a is dropped into the store by hand
 4 decide(h3, a)        the writer on h3 decides a rewrite of a
 7 adopt(h2, a)         another handle adopts the hand-made record: a is projected
 8 obBegin(h1)          an offboarding marks its erasure, with a among what it erases
 9 storeWrite(h3, a)    the rewrite's bytes land in the store
11 obDelete(h1, a)      the offboarding deletes a's record
14 obErase(h1)          and erases a
15 commit(h3, a)        the rewrite is appended against its stale head: the erased id is back
```

Apalache's counterexample to `noWriteWhileErasing` at depth 4 (`.engram/verify-spec/broken-apalache-noWriteWhileErasing.itf.json`) is of the shape `decide(hA, x)`, `storeWrite(hA, x)`, `obBegin(hB)`, `commit(hA, x)`; the handle and item names vary between runs.

## How it is checked, and the bounds

`make verify-spec` runs, in order:

1. `quint typecheck`.
2. `quint test` on the three modules. On `good`, seven scenario tests: five fix an interleaving that card E2.6's review rounds found and check the state the code reaches (a stale rewrite across an erasure, a write after an erasure, a writer's own bytes adopted early, the withdrawal of such an adoption after another handle committed, and two overlapping offboardings whose sweep puts back a write committed meanwhile); `asHeldKeepsTrustTest` pins adoption keeping the plane's provenance; `sweptIdPurgeRaceTest` is the interleaving of a gap card E1.7 closed (below), ending with the write refused. On `broken`, the two refutations. On `threeOffboardings`, the interleaving of the other closed gap, ending with every property holding.
3. Randomized simulation of `good` (`quint run`, Rust backend), checking `safety` in every state: seeds 1, 2 and 3, 5,000 traces of 60 steps each, 4 threads; and of `threeOffboardings`, seed 1, as many traces (card E1.7). This is randomized simulation, not exhaustive: it samples interleavings, as the tests do, at far greater volume. The witnesses it reports count how many traces reached each race; the sweep's put-back is rare at random (4 of the 5,000 three-offboarding traces at seed 1) and is covered by its scenario tests too.
4. Simulation of `broken`, seed 1, against `erasureHolds`, `noWriteWhileErasing` and `noStaleAppend`; each must find a violation. Each output is deleted before its run and the fresh trace's status is checked, so a stale file cannot pass the gate.
5. The trace replay (card E1.8, below): 200 traces of `specs/replay.qnt` and its ten scenario runs written into `specs/traces/`, then `packages/core/test/model/trace-replay.test.ts`.
6. With a JVM on the path, Apalache 0.62.4 (`quint verify`), bounded model checking: every interleaving of `good` up to 4 steps satisfies `safety`, and `broken` violates `noWriteWhileErasing` and `noStaleAppend` within 4 steps. This is exhaustive only to that depth. Depth 4 is the length of the shortest refutation; a run to depth 6 was stopped after ten minutes on this machine while still checking depth 5. Any erasure takes at least 6 steps (a write, its store write and commit, then a mark, a delete and the erase), so at depth 4 Apalache checks `erasureHolds` and the erased-id clause of `noWriteWhileErasing` vacuously, and it is not asked to refute `erasureHolds` on `broken`. The races of card E2.6 need 8 to 22 steps, so beyond depth 4 the evidence is the simulation and the scenario tests. Without a JVM the target says so and the checking is simulation only.

The model's own bounds: three handles, two item ids, at most six fresh contents (writes and outside edits together, at most two outside edits), at most two offboardings begun in `good` and `broken`, three in `threeOffboardings`.

The offboarding bound matters. With three offboardings of the same person the code leaked erased content (below), and `good` could not see it: the third offboarding is what erases the item between the put-back's read and its write. A bound is a statement about what was checked, and a larger one can find what a smaller one hides; so since card E1.7 the three-offboarding module is simulated too.

## What the model found, and card E1.7 closed

Two gaps in the code. Card E1.5 changed nothing under `packages/`, so it pinned both by scenario tests and logged them as findings (`docs/tasks/backlog.md`). Card E1.7 fixed the code and the model together; the same interleavings now end with every property holding, on the model and, replayed, on the code (`packages/core/test/unit/plane/erasure-gaps.test.ts` drives each on two handles, on SQLite and embedded Postgres).

- **The put-back left erased content after a third offboarding** (`threeOffboardings::putBackAcrossThirdErasureTest`, log entry `docs/log/2026-11-21-e1-5-finding-put-back-leak.md`). When the sweep finds that a record it deleted was rewritten meanwhile, it puts the projected item back (`offboard.ts` `run`, the loop after a changed swept record). If a third offboarding erased the item between the put-back's read and its write, the loop's next read found the item gone and ended with `break`, leaving the bytes it had just written: after both reports the store held erased content, and no handle was left to remove it. Now each round decides as `settle`'s `wanted` does: the projected item when it lives at that ref and its scope is not being erased, otherwise nothing, and the record is deleted (`obPutBackRead`, `obPutBackWrite`).
- **Adoption's purge could delete a committed write's record** (`good::sweptIdPurgeRaceTest`, log entry `docs/log/2026-11-21-e1-5-finding-purge-race-on-the-code.md`). A write under an id the sweep removed was allowed (`write.ts` `planeRefusal` checked `lastErasure` only), while adoption refuses that id and deletes its record after committing the refusal (`adopt.ts` `purgeOutcome`). A write that committed between the two kept its item in the projection and lost its store record. Now a new write under a swept id is refused as under an erased one (`engram/write/erased`, at the decision and again at the commit; `decide` uses `removedIn`), and each purge checks under the lock, just before its delete, that its item has not changed, nor an erasure of its scope begun, since the refusal (or, for a purge an earlier adoption decided, since the listing), else it leaves the record to the next adoption. With the write refused, nothing can commit under such an id between that check and the delete.

Two guards are not protected by the four properties: adoption's deferral of a listing older than the log (it guards against a lost update) and the withdrawal (it guards grants, which the model does not carry). Removing either leaves the properties passing; `withdrawalTest` catches the second, nothing catches the first (log entry `docs/log/2026-11-21-e1-5-finding-mutants.md`).

## The trace replay (card E1.8)

The checks above test the model against itself. The replay tests the code against the model: each ITF trace in `specs/traces/` is driven step by step on three real Plane handles (each its own SQLite connection to one log) over one store, and after each step the projection, the store records, the open offboarding marks, the trail of decisions and which handles are inside a call are compared with the trace's state (`packages/core/test/model/replay.ts`, its reader `itf.ts`).

The traces come from `specs/replay.qnt`, module `replay`: good's instance with a step that only restricts what may come next, so each trace is a run of good. The code runs some pairs of steps in one synchronous stretch with no store call between (a stale commit and its settle's read, an erasure and the sweep's head, the sweep's and adoption's loops), so the schedule keeps those pairs together, and it deletes an erasure's records in id order. `make verify-spec` writes 200 traces of 60 steps at seed 1 on one thread (the same seed gives the same traces), gzips them (each ITF state repeats the whole log) and runs the replay.

The two gaps are restated there in the order the code takes them (`sweptIdPurgeRaceReplayTest`, `replayThreeOffboardings::putBackAcrossThirdErasureReplayTest`) and replay to their end: since card E1.7 the code reaches the closed state the model says it does (no erased content in the store; the write refused). The replay found eight more differences between the code and the model, E18-F1 to E18-F8 (one `finding` log entry each, `docs/log/2026-11-28-e1-8-finding-*.md`), each pinned by a scenario run. Card E1.7 closed three of them in the code (`replay.ts` FIXED; their scenarios replay to their end): adoption no longer retracts an item while its scope is being erased (E18-F1), a record refused while its scope was erased is gated again once the erasure completes (E18-F2), and a purge an earlier adoption decided is left to the next adoption when its listing predates a change (E18-F4). The other five stay open (`replay.ts` FINDINGS; each card E1.7's decision entry says why). Of the 200 traces regenerated after the fix, 199 replay to their end with item status compared; the one other first diverges where an E18-F3 mark names the diverging item (`research/results/h1-quint-trace-replay.json`, a proof of concept, not a hypothesis result).

What the replay does not cover: the replay runs every handle in one process, where a synchronous stretch of the code (several transactions, the lock released between them) runs to its end. A handle in another process can append between two transactions of such a stretch, and between the head a sweep or an adoption reads and the store's list it then awaits; `specs/replay.qnt`'s schedule keeps those steps together, so those cross-process interleavings are checked on the model only (good's simulation, Apalache), not on the code.

## What is not modelled

- Grants, and so the settle's narrowing (V-3) and the grant conflict path; the withdrawal is modelled.
- Lineage (promotions and derived writes, V3-1, V4-1), team and role scopes, and the handover.
- Store failures, `NotDeletableError` and the records an erasure leaves in a store (`keptInStore`, the left-content hashes); a writer that crashes between its store write and its commit.
- The give-up paths of the retry loops. `settle` throws after `SETTLE_ROUNDS` (8) rounds, the sweep's put-back stops after 4, and the handover after `HANDOVER_ATTEMPTS` (4). The model retries without limit, so it has none of those paths and none of what they leave behind.
- Item status. A withdrawal to nothing is a removal in the model; the code appends a retire, which leaves the item projected as retired. Retirement by retention or by adoption's retractions, budgets, and the gate's own policy (it always allows) are not modelled either. Within the model's bounds the store lacks the record of a live item only while an erasure is open, where adoption no longer retracts (card E1.7), so the missing retraction is not reached.
- A copy of erased content made outside the plane under a new id (ADR 0010's second open question): the outside party writes fresh content only.

## Running it

```
make verify-spec                         the whole check, about five minutes
npx --yes @informalsystems/quint@0.33.1 run specs/commit.qnt --main=good --invariant=safety --max-samples=1000 --max-steps=40 --seed=7
npx --yes @informalsystems/quint@0.33.1 test specs/commit.qnt --main=threeOffboardings
```

Quint is run through `npx` at an exact version rather than as a workspace dependency, so the lockfile and every `pnpm install` stay untouched. On first use it fetches its Rust simulator and Apalache into `~/.quint` (network, once; Apalache's jar is 197 MB and the first `quint verify` prints nothing while it downloads). Apalache writes its working files into `.engram/verify-spec/`, which git ignores.
