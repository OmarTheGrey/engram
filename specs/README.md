# specs: a checked model of the commit and erasure protocol

`specs/commit.qnt` is a [Quint](https://github.com/informalsystems/quint) model of the protocol card E2.6 built: several handles (processes) over one event log and one store, each deciding at the log's head and appending conditionally, with offboarding's mark, erasure and sweep, adoption, and a write after an erasure (card E1.5). `make verify-spec` checks it. It runs outside `make test`.

This is bounded checking of a model, not a proof of the code. The model is written by hand from `packages/core/src/plane/` and can drift from it; each transition names, in a comment, the function and file it models.

## What is modelled

One person scope holding two item ids, three handles, and an outside party that edits store records by hand. Every step that reads or appends the log is one transaction under the log's lock (ADR 0024); every store call is a step of its own, so another handle may move between it and the transaction that follows.

| transition | models |
|---|---|
| `decide` | `write.ts` `decideWrite`, `planeRefusal`, `appendRefusal`: the head noted, the projection read; refused while the scope is being erased (`engram/offboard/erasing`) or for a new item under an erased id (`engram/write/erased`) |
| `storeWrite` | `write.ts` `decideAndWrite`: `adapter.write` |
| `commit` | `write.ts` `decideAndWrite`, `commit.ts` `staleness` and `ownBytes`: the conditional append |
| `settleRead`, `settleStore`, `settleConfirm` | `commit.ts` `settle`, `wanted`, `recovery`: the stale writer puts the store back, withdraws an adoption of its own bytes (V-2), and appends its deny (`engram/write/conflict`) |
| `obBegin` | `offboard.ts` `run`: the begin mark, appended with the read of what will be erased |
| `obDelete`, `obErase` | `offboard.ts` `run`: the store deletes, then the erase events and the redaction of every earlier copy |
| `obSweepList`, `obSweepDecide`, `obSweepDel`, `obSweepCommit`, `obPutBack*` | `offboard.ts` `run`: the sweep, its check under the lock, and its put-back (V-1, V-5, V3-2) |
| `obReport` | `offboard.ts` `run`, `commit.ts` `erasureOpen`: the report closes its mark and every mark open when that one was appended (V-1) |
| `obStop` | an offboarding that stops after its mark (a crash, a handover's store failure) |
| `adoptList`, `adoptOne`, `adoptPurge`, `adoptDone` | `adopt.ts` `adoptStoreItems`, `erasedRefusal`, `purgeOutcome`; `write.ts` `adoptWrite`, `adoptedItem`: the listing's head, the deferral, the erased-id refusal and purge, the trust ceiling |
| `outsideEdit` | a person writing a memory file by hand, claiming any kind |

## The four safety properties

1. `noStaleAppend`. No event is appended against a stale head: every gated write's allow has no counted change to its item (`commit.ts` `touchedSince`, its own adopted bytes aside) and no offboarding begun between its basis and its append.
2. `erasureHolds`. An erased item's content appears in no later state: no log event and no projected item holds erased content, no projected item holds an erased id, and the store holds a record under an erased id, or holding erased content, only while a call that will remove it is in flight (a stale writer settling, an adoption's purge, a sweep's delete), or when an outside party wrote it.
3. `noWriteWhileErasing`. An offboarded scope accepts no later write: no allowed write, adoption or withdrawal into the person scope while an erasure of it is open, and none under an erased id ever. A write under a fresh id after the report is accepted, as the code accepts it (ADR 0010's first open question), so it is not counted.
4. `adoptionNeverRaisesTrust`. Every adoption records a kind no more trusted than import, than the record's claim and than the plane's kind for the id; and every projected item more trusted than import is backed by a gated write of its content at that kind or above.

`safety` is their conjunction.

## The broken variant

The module `broken` sets `CHECKED = false`: the conditional append is removed, so `commit` appends whatever the head now holds. The checker must refute `noStaleAppend` there, and `make verify-spec` exits non-zero if it does not. The scenario test `broken::staleAppendTest` pins the shortest refutation, and both the simulator and Apalache find it. The counterexample the simulator found (seed 1, from `.engram/verify-spec/broken-simulation.itf.json`):

```
1 decide(h3, b)        the writer on h3 decides a write of b at head -1
2 storeWrite(h3, b)    its bytes land in the store
3 obBegin(h2)          an offboarding on h2 appends its begin mark (seq 0)
4 obErase(h2)          and commits its (empty) erasure
5 outsideEdit(a)       an outside edit, irrelevant
6 commit(h3, b)        the write is appended (seq 1) against head -1, after the mark
```

Apalache's counterexample, at depth 4 (`.engram/verify-spec/broken-apalache.itf.json`), is the same race without the noise: `decide(h2, a)`, `storeWrite(h2, a)`, `obBegin(h3)`, `commit(h2, a)`.

Without the check, the write lands into a scope being erased: `noStaleAppend` and `noWriteWhileErasing` both fail, and with an item to erase, `erasureHolds` fails too (the erased id comes back).

## How it is checked, and the bounds

`make verify-spec` runs, in order:

1. `quint typecheck`.
2. `quint test` on both modules: six scenario tests on `good` and the refutation on `broken`. Five fix an interleaving that card E2.6's review rounds found and check the state the code reaches: a stale rewrite across an erasure, a write after an erasure, a writer's own bytes adopted early, the withdrawal of such an adoption after another handle committed, and two overlapping offboardings whose sweep puts back a write committed meanwhile. The sixth, `sweptIdPurgeRaceTest`, pins a gap the model found (below).
3. Randomized simulation of `good` (`quint run`, Rust backend), checking `safety` in every state: seeds 1, 2 and 3, 5,000 traces of 60 steps each, 4 threads. This is randomized simulation, not exhaustive: it samples interleavings, as the tests do, at far greater volume. The witnesses it reports count how many traces reached each race; the sweep's put-back is rare at random and is covered by its scenario test instead.
4. Simulation of `broken` against `noStaleAppend`, seed 1, which must find a violation.
5. With a JVM on the path, Apalache 0.62.4 (`quint verify`), bounded model checking: every interleaving of `good` up to 4 steps satisfies `safety`, and `broken` violates `noStaleAppend` within 4 steps. This is exhaustive only to that depth. Depth 4 is the length of the shortest refutation; a run to depth 6 was stopped after ten minutes on this machine while still checking depth 5, and the races of card E2.6 need 8 to 22 steps, so beyond depth 4 the evidence is the simulation and the scenario tests. Without a JVM the target says so and the checking is simulation only.

The model's own bounds: three handles, two item ids, at most six fresh contents (writes and outside edits together, at most two outside edits), at most two offboardings begun.

## What the model found

One race outside the four properties. A write under an id the sweep removed is allowed (`write.ts` `planeRefusal` checks `lastErasure` only), while adoption refuses that id and deletes its record after committing the refusal, outside the lock (`adopt.ts` `purgeOutcome`). A write that commits between the two keeps its item in the projection and loses its store record. `good::sweptIdPurgeRaceTest` pins the interleaving; the code is unchanged, as card E1.5 changes nothing under `packages/` (log entry `docs/log/2026-11-21-e1-5-finding-purge-after-swept-id.md`).

Two guards are not protected by the four properties: adoption's deferral of a listing older than the log (it guards against a lost update) and the withdrawal (it guards grants, which the model does not carry). Removing either leaves the properties passing; `withdrawalTest` catches the second, nothing catches the first (log entry `docs/log/2026-11-21-e1-5-finding-mutants.md`).

## What is not modelled

- Grants, and so the settle's narrowing (V-3) and the grant conflict path; the withdrawal is modelled.
- Lineage (promotions and derived writes, V3-1, V4-1), team and role scopes, and the handover.
- Store failures, `NotDeletableError` and the records an erasure leaves in a store (`keptInStore`, the left-content hashes); a writer that crashes between its store write and its commit.
- The bounds on retries (`SETTLE_ROUNDS`, `HANDOVER_ATTEMPTS`, the sweep's four put-back rounds): the model retries without limit, which only adds behaviours.
- Item status, retirement by retention or by adoption's retractions, budgets, and the gate's own policy (it always allows).
- A copy of erased content made outside the plane under a new id (ADR 0010's second open question): the outside party writes fresh content only.

## Running it

```
make verify-spec                         the whole check, about seven minutes
npx --yes @informalsystems/quint@0.33.1 run specs/commit.qnt --main=good --invariant=safety --max-samples=1000 --max-steps=40 --seed=7
npx --yes @informalsystems/quint@0.33.1 test specs/commit.qnt --main=good
```

Quint is run through `npx` at an exact version rather than as a workspace dependency, so the lockfile and every `pnpm install` stay untouched; on first use it fetches its Rust simulator and Apalache into `~/.quint` (network, once). Apalache writes its working files into `.engram/verify-spec/`, which git ignores.
