# ADR 0008: Lints: deterministic first, model-based second, both as events

Status: accepted, 2026-10-22
Deciders: Omar (lead); drafted in step-0 task S0.13 by the coding agent for the lead's review
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

HaluMem (evaluate per operation, not end to end); the knowledge-conflicts taxonomy (inter-context conflicts need detection, and resolution is policy); Ground Truth First (write-stage errors track downstream failure).

## Decision

(a). A lint finding is an event with `lint_id`, `severity`, `evidence`. Model-based lints take an injected `ModelCall`, are seeded and cached, and are reported separately in H3. Each lint ships a flag fixture and a near-miss fixture.

## Alternatives considered

(a) Two tiers with the same interface: deterministic (expired validity, source changed, scope or class mismatch, missing provenance, orphan, duplicate) and model-based (contradiction, unsupported claim). (b) One model-based pass.

## Consequences

Unblocks L1, L3, L4, X10. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
