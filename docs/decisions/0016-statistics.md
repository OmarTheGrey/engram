# ADR 0016: Statistics: paired bootstrap, Holm, three models from three providers, stopping rules

Status: accepted with amendments, 2026-10-22
Deciders: Omar (lead); drafted in step-0 task S0.13 by the coding agent for the lead's review
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Kapoor (joint accuracy and cost, holdouts); MERIT (seed gaps up to 0.45 on the same task, so seeds are not optional); Nosek (fix the analysis first).

## Decision

Three hosted models from three providers through pi-ai, three seeds each; paired bootstrap intervals on condition differences per benchmark; Holm across the five hypotheses; a stopping rule per hypothesis written before the first run; analysis code tested on synthetic data with planted effects before it sees real data.

Amendments made when deciding:

- Amended from S0.10: pi-ai exposes no sampling seed, so each seed is one cached sample; replays are exact and fresh samples are not.
- Pre-registration v0 fixes the interval as a BCa paired bootstrap with 10,000 resamples.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks R1, X2 onward. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/research/preregistration.md`
- `docs/readings/litreview/methods-holm-1979.md`
