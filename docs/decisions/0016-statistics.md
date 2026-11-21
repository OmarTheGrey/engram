# ADR 0016: Statistics: paired bootstrap, Holm, three models from three providers, stopping rules

Status: accepted with amendments, 2026-11-02
Deciders: Omar (lead)
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

Amendment of 2026-11-21, recording answers given on 2026-11-20 under the lead's delegation (`docs/tasks/lead-decisions.md`), carried by the answers card; the lead may overturn any:

- Item 1, the lead's own answer: the three models are DeepSeek v4 pro (M1), GLM 5.3 Flash (M2) and Mistral Large 4 (M3), from three makers, all through OpenRouter with reasoning off. M2's reasoning cannot be turned off through pi-ai 1.3.0, which the pre-registration's Models section states for the lead.
- Item 8: a hypothesis that does not run enters Holm with p = 1, so the adjustment stays over five.
- Item 10: an undecided H1 read-out at Gate C (p below 0.05, 5p at or above it) continues the programme as planned and is reported as undecided; the final Holm over all five decides.
- Item 3: each run's spend ceiling is 1.25 times its high cost estimate, per provider (`spend_ceiling_usd`); item 4: a session is capped at 8 model calls, and a capped session is excluded and counted per condition.
