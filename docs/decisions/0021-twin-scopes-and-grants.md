# ADR 0021: Twin: person and role scopes, consent grants, handover; offboarding deferred

Status: accepted, 2026-10-22
Deciders: Omar (lead); drafted in step-0 task S0.13 by the coding agent for the lead's review
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

GateMem's shared-pool leaks; the 1,000 People paper (interview-grounded twins are measurable, and consent and deletion are design); PersonaMem (preferences supersede).

## Decision

Every person has a `person` scope (never readable by others without a grant) and a `role` scope (handed to a successor by event). Grants are explicit, scoped by class, and expire. Twin bootstrapping from an interview is a prompt template in the pi package. Offboarding with a deletion report stays on the kill list.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E9.1 to E9.5. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
