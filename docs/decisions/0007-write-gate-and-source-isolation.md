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

## Alternatives considered

(a) Deterministic rules only: source kind, scope, class, provenance presence, hash, size, and a per-scope budget. (b) Add a model-based classifier at write time.

## Consequences

Unblocks E2.2, L2, the MPBench arm. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2606.04329-mpbench.md`
- `docs/readings/litreview/2606.24322-origin-bound-authority.md`
