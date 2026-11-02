# ADR 0011: One lifecycle for every class; replay admission for procedures

Status: accepted with amendments, 2026-11-02
Deciders: Omar (lead)
Supersedes: the proposal of the same number in `docs/decisions/README.md`

## Context

SKILL.nb (provisional, released, retired; evidence attached; gated execution); MSCE (probationary, active, archived; reliability score; boundary narrowing on rejection); Voyager (store only after a verified run); EvoMemBench (memory gains are conditional, so admission must be measured).

## Decision

`status` in {candidate, active, retired} for all classes. Procedures move candidate to active only after replay validation passes k of n runs on held-out tasks; active procedures carry a smoothed success rate; a drop below threshold or a changed environment hash retires them. A human can reject, which narrows the trigger rather than deleting the item.

Amendments made when deciding:

- From the literature review (Library Drift 2605.19576, SkillGuard 2605.10990): retirement fires only after a minimum number of trials, and the environment hash becomes a list of the environment assumptions a procedure depends on.

Amendments made when implementing card E2.5, 2026-10-29:

- The promotion mechanism is ADR 0026: what a confirmation is (an allowed write of the same normalised content in the same scope by a distinct actor with a user, document or tool source), who may review (a user-sourced member of the target scope who does not own the item), and the validation record a procedural candidate needs (`{ k, n }` meeting `replay_k` of `replay_n`). `Plane.promote` (packages/core/src/plane/promote.ts) and the pure `evaluatePromotion` (packages/core/src/policy/promotion.ts) implement it. Until card D3 supplies replay records, no procedural candidate becomes active through the plane.
- Each preset's comment states the one-sided Wilson upper bound on the failure rate its `replay_k` of `replay_n` implies at alpha 0.05 (5 of 5: 0.35, 4 of 5: 0.56, 3 of 5: 0.73), computed in packages/core/test/unit/policy/presets.test.ts. The smoothed success rate on active procedures stays a later schema change (D4).

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks D1 to D4, H5. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2605.19576-library-drift.md`
- `docs/readings/litreview/2605.10990-skillguard-drift.md`
