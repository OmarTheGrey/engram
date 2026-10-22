# ADR 0009: Retrieval explanations carry score components, rank and policy decision

Status: accepted with amendments, 2026-10-22
Deciders: Omar (lead); drafted in step-0 task S0.13 by the coding agent for the lead's review
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

Generative Agents' scored retrieval (recency, importance, relevance); Lost in the Middle (rank is part of the outcome); MERIT (agents act on a retrieved value only about half the time, so what was returned and where must be inspectable).

## Decision

Every `Plane.read` returns items with an `explanation`: score components, rank, the policy rule that admitted the item, grants used, and the validity window applied. The same record is what the inspector shows and what `custom_message` carries into the model when policy allows.

Amendments made when deciding:

- Implemented as the Explanation schema in S0.7: score total and components, rank, the admitting `policy_id`, grants used, and the validity window applied.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E2.4, the inspector, the explanation evaluation. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
