# ADR 0010: Retention never deletes; eviction retires; long-horizon arm is mandatory

Status: accepted, 2026-10-22
Deciders: Omar (lead); drafted in step-0 task S0.13 by the coding agent for the lead's review
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Ground Truth First's tenure crossover (budgeted memories win at three weeks and lose at nine because eviction removed old material); MemSecBench's finding that selective repair damages benign memory.

## Decision

Retention budgets per scope trigger `retire` events, never deletes; retired items stay replayable and can be reinstated by event. Hard deletion exists only for person-scope erasure and emits a deletion report. The evaluation includes a long-horizon arm so the cost of eviction appears.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E2.5, X9, Twin erasure. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
