# ADR 0007: Write gate rules and source isolation

Status: accepted, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

MPBench (aggressive write policies are easier to poison; weak-signal attacks evade detectors); MemSecBench (adoption is the bottleneck, so blocking at write is cheaper than catching at read); Mem0's ADD, UPDATE, DELETE, NOOP as the interception point.

## Decision

(a) at the gate; model-based checks are lints that run after the write and can retire. The gate is deterministic so the H1 condition "enforcement" has no model in it. Every MPBench attack class maps to a rule or a lint in `fixtures/faults/`; classes with no deterministic defence are listed in the thesis as such.

Amendments made in the review fix pass, 2026-10-25 (PR #5, findings R5-1 to R5-14; pending the lead's review like the rest of this ADR):

- Decisions D4 and D6 (findings R5-3 to R5-7, R5-14, PR #5): the gate's checks, in order, are membership (`engram/write/membership`), rewrite owner and version (`engram/write/version`), grants (`engram/write/grant`), then the policy rule of the scope level (default deny `engram/write/default-deny`, forbidden class, listed source, source isolation, confidence floor, review). Provenance is set from the actor's harness-set source before the gate (ADR 0004).
- Decision D6: every outcome of a write is an event. An invalid actor or time is refused with `InvalidCallError` before the store or the log is touched, since no event can carry an invalid actor id or timestamp; an invalid item is a schema denial event as before. If the adapter throws after an allow, or returns a ref that is malformed, belongs to another adapter, or is already held by an item outside the written item's lineage, the plane appends one deny event (`engram/write/store-failure`, reason with the error) and rethrows; the store may hold bytes the plane never projects, and the event says so.

Amendments made in round 2 of the review fix pass, 2026-10-28 (PR #5, verifier findings N2 to N4; pending the lead's review like the rest of this ADR):

- Finding N2: writes over one db handle run one at a time, in call order, through an async queue in `gatedWrite` (packages/core/src/plane/write.ts); a failed write does not stall it. Chosen over re-checking the projected item inside the event transaction because the re-check runs after the adapter has written: a losing write would already have replaced the winner's bytes in the store (the fake and the files adapter key by item id), leaving the log honest but the store wrong. The queue stops the losing write before the store. Reads are not queued; each takes the projection once, synchronously. Limit: writers in another process sharing one log file (the CLI beside a pi session on `<home>/.engram/engram.db`) are not serialised by it.
- Finding N3: when the projected item of the written id lies in a scope the writer cannot read (by membership and the read matrix), the denial's reason is "the item id is held by an item you cannot access" and names no scope, owner or version. The reason travels in the WriteResult's event, which the pi extension shows to the model, so the detail is kept out of the event as well. The policy_id still names the deciding rule (rule 3).
- Finding N4: the plane cannot prevent a store from writing at a ref another item holds, since refs are the adapter's and not predictable before the write. The adapter contract already forbids it (the conformance suite's "two item ids are two items under two refs" and "write is idempotent per item id"), so only a non-conforming store reaches this; the store-failure event's reason now says the store broke the contract, that the bytes it wrote for the item are orphaned and never projected, and that they may have replaced the other item's record in the store.

Amendments made in the review fix pass, 2026-10-25 (PR #6, findings R6-2 to R6-4; pending the lead's review like the rest of this ADR):

- Decision D8: adoption (`adoptStoreItems`, packages/core/src/plane/adopt.ts) puts what a store already holds through this gate as the store's owner, not as whoever reads: the CLI passes `{ id: person:<owner>, level: person, memberships: [person:<owner>] }`, and adoption sets `source: import` itself whatever the caller passed. Every adoption event's reason starts "adopted from store <name>: ". An allowed item is recorded at the store_ref it already has, through the same ref checks and store-failure event as a written one. When a projected item of the store's scope is no longer listed, or the store's version of it is denied, the plane retires the projected item with one event (op retire, decision allow, policy_id `engram/adopt/retract`, reason naming why), so it never serves content the store no longer has. A denied item is not gated again while its hash (of the store's item, status aside, recorded at the end of the deny event's reason) is unchanged; a retracted item the store holds again is gated again; an item retired by anything other than adoption is not brought back while the store has it unchanged.

Amendments made in the review fix pass, round 2, 2026-10-29 (PR #6; pending the lead's review like the rest of this ADR):

- An item the store can no longer read (it reports the key through `Adapter.diagnostics`, ADR 0013) is retired, and its retire reason says the store can no longer read it and names the store's diagnostic, instead of "no longer in store". It is retired rather than kept because the plane must not serve content the store no longer holds in a readable form: the store's own read of the entry throws, and what the plane holds is a version the store has since changed. When the entry is readable again it is gated again, as any retracted item the store holds.
- Adoption compares the store's item with the projected one, and hashes it for the deny note, without the fields the adapter reports through `derivedFields` (the files adapter's modification-time `valid_from`). Touching a file therefore adds no write, retire or deny event; the projection keeps the `valid_from` of the version it adopted. A change to a field the store stores, `valid_from` in an Engram file's frontmatter included, is still gated again. A log whose deny notes were written before this change gates such a denied item once more, then records the new hash.

Amendments made in the review fix pass, 2026-10-25 (PR #7, findings R7-1 to R7-15; pending the lead's review like the rest of this ADR):

- Decision D12 (findings R7-3, R7-4): in a pi session the gate decides in `tool_call` and commits in the tool's `execute`. `Plane.checkWrite(actor, item, at)` gives the decision `write` would give, computed by the same code, with no store write and no event; a deny is then committed in `tool_call` (one deny event) and blocks the call with the Plane's reason. An allowed write is committed by `Plane.write` in `execute`, from the arguments execute receives, so a call that a later handler blocks or that is aborted before it runs never reaches the store or the log as allowed. No pending state is kept between the two: each execute builds its own item, so two calls sharing a tool call id are two writes with their own results (D12 asked for pending state keyed by tool call id; with none, the case cannot cross).
- Decision D4 as the extension applies it: the agent's writes carry the actor's source `model`, so the plane sets the provenance kind and actor.

Amendments made when implementing card E2.4, 2026-10-29 (ADR 0025; pending the lead's review like the rest of this ADR):

- The write queue of finding N2 is its own module, `inWriteQueue(db, task)` in packages/core/src/plane/queue.ts, shared by every Plane call that changes items: `Plane.write` and `Plane.retain` now, `Plane.promote` (card E2.5) next. After a landing write, its budget check (ADR 0025) runs in the same queue slot, so no other write or sweep interleaves between the write and its evictions.
- The gate gains a check after the confidence floor: a `model`, `compaction` or `tool` write whose normalised content hash equals that of an item retired in its scope is denied with `engram/write/retired-content` (ADR 0025, decision 5). `Plane.checkWrite` gives the same decision.

- Review fix pass of PR 4 (findings P4-3 and P4-8, and the review's note on adoption): a call to `inWriteQueue` from inside a task on the same db rejects with `NestedWriteQueueError` instead of waiting for itself and stalling the log's queue; inside a task the in-slot primitives are `enforceBudget` and `appendEvent`. Adoption's retractions are appended inside the write queue, reading the projection again there. The retired-content check counts only items an allowed retire or evict event retired, never one written with status `retired`.

## Alternatives considered

(a) Deterministic rules only: source kind, scope, class, provenance presence, hash, size, and a per-scope budget. (b) Add a model-based classifier at write time.

## Consequences

Unblocks E2.2, L2, the MPBench arm. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2606.04329-mpbench.md`
- `docs/readings/litreview/2606.24322-origin-bound-authority.md`
