# ADR 0011: One lifecycle for every class; replay admission for procedures

Status: accepted with amendments, 2026-10-22
Deciders: Omar (lead); drafted in step-0 task S0.13 by the coding agent for the lead's review
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

SKILL.nb (provisional, released, retired; evidence attached; gated execution); MSCE (probationary, active, archived; reliability score; boundary narrowing on rejection); Voyager (store only after a verified run); EvoMemBench (memory gains are conditional, so admission must be measured).

## Decision

`status` in {candidate, active, retired} for all classes. Procedures move candidate to active only after replay validation passes k of n runs on held-out tasks; active procedures carry a smoothed success rate; a drop below threshold or a changed environment hash retires them. A human can reject, which narrows the trigger rather than deleting the item.

Amendments made when deciding:

- From the literature review (Library Drift 2605.19576, SkillGuard 2605.10990): retirement fires only after a minimum number of trials, and the environment hash becomes a list of the environment assumptions a procedure depends on.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks D1 to D4, H5. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2605.19576-library-drift.md`
- `docs/readings/litreview/2605.10990-skillguard-drift.md`
