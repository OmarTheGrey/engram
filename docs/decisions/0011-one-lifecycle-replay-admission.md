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

Amendments made when implementing card D4 of the second absorb plan, 2026-11-28 (proposed, for the lead's acceptance; `docs/log/2026-11-28-d4-decision-retirement-rule.md`, `docs/log/2026-11-28-d4-decision-environment-revalidates.md`):

- The retirement rule is this ADR's, as the presets set it: a re-validated procedure retires when its success rate falls below `lints.thresholds` `replay-drift.success-floor` after at least `replay-drift.min-trials` trials. Card D4's own wording, "below the admission rule", is not the retirement rule: D3's k of n is reported in every re-validation's reason, and it is the rule for restoring a retired procedure (below).
- The success rate is the re-validation's own: the mean reward with the procedure over every held-out task and seed of the replay (15 trials at 5 tasks and seeds 1 to 3), not smoothed across re-validations and not stored on the item. The log keeps no per-trial history, and a stored rate is a schema change (AGENTS.md rule 5); "a smoothed success rate" stays later work.
- A changed environment hash does not retire outright: it makes a re-validation due (`procedures.drift.environment_change`, card E2.14's option), and the re-validation's rate decides. So does a period since the last validation (`procedures.drift.period`). The environment hash is presented with the replay by the user who ran it, as the outcomes are (ADR 0046); the runner's is sha256 of the held-out tasks' files and tool answers.
- Re-validation is `Plane.revalidate`, presented outcomes only (rule 4), one event per decision with its reason and rule (`<policy>/drift/<trigger>`, rule 3). A retired version stays in the store and the log (ADR 0010); a re-validation that meets the admission rule (replay_k of replay_n) and the floor again restores that version (`<policy>/drift/restored`), the rollback SKILL.nb describes. Off by default, and off in every registered preset.
- "A human can reject, which narrows the trigger" is not built by D4.

## Alternatives considered

No alternatives were recorded beyond the recommendation.

## Consequences

Unblocks D1 to D4, H5. Changing this decision needs a new ADR that supersedes this one and a `decision` log entry.

## Sources

- `docs/decisions/README.md` (the proposal)
- `docs/readings/litreview/2605.19576-library-drift.md`
- `docs/readings/litreview/2605.10990-skillguard-drift.md`
