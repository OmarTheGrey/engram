# ADR 0008: Lints: deterministic first, model-based second, both as events

Status: accepted, pending lead review, 2026-10-22
Deciders: drafted by the coding agent in step-0 task S0.13; pending review and acceptance by Omar (lead). Until then this records a recommendation the code already follows.
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

HaluMem (evaluate per operation, not end to end); the knowledge-conflicts taxonomy (inter-context conflicts need detection, and resolution is policy); Ground Truth First (write-stage errors track downstream failure).

## Decision

(a). A lint finding is an event with `lint_id`, `severity`, `evidence`. Model-based lints take an injected `ModelCall`, are seeded and cached, and are reported separately in H3. Each lint ships a flag fixture and a near-miss fixture.

Amendments made in the review fix pass, 2026-10-25:

- D2, lints and conditions: a preset's `lints.enabled` lists the lints a lint-running condition (C6) uses; it does not turn lints on. C5 is the write gate and the read filter only, whatever the preset says. The presets' comments and the C5 and C6 rows of `docs/research/preregistration.md` (v0.2) say so.
- D2, one registry: lint ids come from `LINT_IDS` in `packages/core/src/lint.ts` (deterministic: expired-validity, source-changed, scope-class-mismatch, missing-provenance, orphan, duplicate; model-based: contradiction, unsupported-claim). `replay-drift` and `environment-changed` are procedural lifecycle triggers of ADR 0011 and live in their own list, `LIFECYCLE_TRIGGERS`. `near-duplicate` is a threshold key, not a lint; the threshold keys are `LINT_THRESHOLD_KEYS` (near-duplicate, replay-drift.success-floor, replay-drift.min-trials). The policy loader rejects an unknown or duplicate lint id and an unknown threshold key at its line.

## Alternatives considered

(a) Two tiers with the same interface: deterministic (expired validity, source changed, scope or class mismatch, missing provenance, orphan, duplicate) and model-based (contradiction, unsupported claim). (b) One model-based pass.

## Consequences

Unblocks L1, L3, L4, X10. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
