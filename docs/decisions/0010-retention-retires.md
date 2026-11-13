# ADR 0010: Retention never deletes; eviction retires; long-horizon arm is mandatory

Status: accepted, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Ground Truth First's tenure crossover (budgeted memories win at three weeks and lose at nine because eviction removed old material); MemSecBench's finding that selective repair damages benign memory.

## Decision

Retention budgets per scope trigger `retire` events, never deletes; retired items stay replayable and can be reinstated by event. Hard deletion exists only for person-scope erasure and emits a deletion report. The evaluation includes a long-horizon arm so the cost of eviction appears.

Amendments made when implementing card E2.4, 2026-10-29:

- The mechanism is ADR 0025 (`docs/decisions/0025-retention-semantics.md`): expiry retires with op `retire`, budget overage with op `evict` in the rule's order (recency, utility, manual), both decided by the pure `evaluateRetention` (packages/core/src/policy/retention.ts) and appended by `Plane.retain` and the write path's budget check (packages/core/src/plane/retention.ts). "Never deletes" holds in both places it could fail: the event sets the projected status to retired, and the plane never writes or deletes the item in the store, so the store keeps the bytes and adoption leaves an item retired by retention retired while the store has it unchanged (ADR 0007's adoption amendment).

Amendments made by card E9.7, 2026-11-06 (branch `e9-7-offboarding`):

- The person-scope erasure is implemented by `offboard` (packages/core/src/plane/offboard.ts). Every item in the person scope, every version and status, is deleted from the store, its projection and explanation rows are removed, and its content, provenance ref and evidence hash are redacted in every earlier event that carries it; one `retire` event per item under `engram/offboard/erase` (events.ts `ERASURE_ID`) then removes it from the projection and from replay (`itemsAt`), so a rebuilt projection equals the incremental one and the item never comes back from the log (`packages/core/test/replay/erasure.test.ts`). The redaction is the one rewrite of the append-only log (ADR 0003): without it the log would keep what erasure deletes. The events, their ids, decisions and reasons stay, so what was decided remains auditable.
- The deletion report names what was erased and handed over by id, the store refs deleted and any the store failed to delete, and what the call cannot reach: a store's own history (`native_history`, such as Letta's git), pi session files that mirrored the events, and backups. It carries no content. One summary event (`engram/offboard/report`) records the offboarding.

Amendments made in the review of PR #33, 2026-11-13:

- Erasure deletes a store ref only when no item outside the person scope holds it. A ref shared with such an item (a version of the same store record, as adoption makes) is kept in the store, since deleting it would delete that item's bytes; the erased items' copies in the log are redacted all the same, and the deletion report names how many refs were kept (`packages/core/test/unit/plane/offboard-edges.test.ts`).

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E2.5, X9, Twin erasure. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
