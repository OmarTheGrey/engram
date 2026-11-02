# ADR 0021: Twin: person and role scopes, consent grants, handover; offboarding deferred

Status: accepted, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

GateMem's shared-pool leaks; the 1,000 People paper (interview-grounded twins are measurable, and consent and deletion are design); PersonaMem (preferences supersede).

## Decision

Every person has a `person` scope (never readable by others without a grant) and a `role` scope (handed to a successor by event). Grants are explicit, scoped by class, and expire. Twin bootstrapping from an interview is a prompt template in the pi package. Offboarding with a deletion report stays on the kill list.

Amendments made in the review fix pass, 2026-10-25 (PR #5, findings R5-1 to R5-14):

- Decision D4 (finding R5-7, PR #5): the write gate denies (`engram/write/grant`) a grant to `*`, to a bare kind wildcard such as `person:*` or `agent:*`, or with a `*` anywhere but last (a pattern names a kind and a non-empty prefix, such as `agent:claude-code/*`); a grant without `class` or without `expires`, as this ADR requires; and any grant on model or compaction content. The Grant schema still marks `class` and `expires` optional, since changing it is a schema PR (AGENTS.md rule 5); the gate is where the requirement is enforced, and the read filter still honours a grant without them for items that never passed the gate.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks E9.1 to E9.5. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
