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

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E2.5, X9, Twin erasure. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
