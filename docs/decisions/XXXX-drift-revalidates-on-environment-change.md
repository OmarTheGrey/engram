# ADR XXXX: A changed environment hash re-validates an admitted procedure; drift retires on the success floor after min-trials

Status: proposed, 2026-11-28
Deciders: drafted by card D4 of the second absorb plan; for the lead's acceptance
Supersedes: ADR 0011's sentence "a changed environment hash retires them", and only that sentence. The rest of ADR 0011 stands.

## Context

- ADR 0011 (accepted) decides that "active procedures carry a smoothed success rate; a drop below threshold or a changed environment hash retires them", with the literature amendment that retirement fires only after a minimum number of trials (Library Drift 2605.19576, SkillGuard 2605.10990) and that the environment hash becomes a list of the environment assumptions a procedure depends on. Its Consequences say a change to the decision needs a superseding ADR.
- Card E2.14 (merged) added `procedures.drift` to the policy schema: `environment_change` ("re-validate when the procedure's environment hash changes") and `period`. Its comment names ADR 0011's retirement rule and the two threshold keys every registered preset already sets, `lints.thresholds` `replay-drift.success-floor` and `replay-drift.min-trials` (strict 0.8, medium 0.7, permissive 0.6; 10 trials each).
- Card D4's text retires a procedure "below the admission rule" (card D3's 4 of 5 held-out tasks at a mean reward of 2/3, no worse than without it), and re-validates on an environment change.
- ADR 0046 (accepted) makes a replay presented evidence: the plane calls no model (AGENTS.md rule 4), only a user-sourced actor presents a replay, and no surface exposes one until point 7 is lifted. ADR 0026 is the promotion mechanism; ADR 0010 keeps retired items in the store and the log.
- The item schema carries neither an environment hash nor a success rate, and only a schema card changes `schema.ts` (rule 5).

## Decision

1. **An environment change re-validates; it does not retire.** When `procedures.drift.environment_change` is `on` and the environment hash the procedure was last validated in differs from the one the re-validation ran in, a re-validation is due (`environment-changed`). So is one `procedures.drift.period` seconds after the last validation (`replay-drift`). The re-validation's replay decides whether the procedure retires. This supersedes ADR 0011's "a changed environment hash retires them".
2. **The retirement rule is ADR 0011's, as the presets set it.** A due re-validation retires the procedure when its success rate, the mean reward with the procedure over every held-out task and seed of the replay, is below `replay-drift.success-floor` after at least `replay-drift.min-trials` trials; otherwise it is kept. Card D4's "below the admission rule" is not the retirement rule; D3's k of n is reported in every reason. A policy that sets `procedures.drift` without both thresholds is refused by the loader.
3. **The rate is the re-validation's own.** It is not smoothed across re-validations and not stored on the item: the log keeps no per-trial history, and a stored rate is a schema change. ADR 0011's "smoothed success rate" stays later work.
4. **The environment hash is presented, not a list of assumptions.** The user who ran the re-validation presents the hash the procedure was last validated in and the current one, as ADR 0046 trusts the outcomes. The runner's hash is sha256 of the held-out tasks' files and tool answers. The literature amendment's list of environment assumptions a procedure depends on is not built (it would be a schema change on the item).
5. **Re-validation is `Plane.revalidate`, one event per decision.** Retired: a `retire` allow under `<policy>/drift/<trigger>`; kept: a `retire` deny under the same rule; every refusal (drift off, not due, not user-sourced, not a reader and member of the scope, not an active or drift-retired procedure, thresholds missing, a replay not the item's) one deny event (rule 3). Off by default and in every registered preset.
6. **A restore goes through the promotion gate.** A drift-retired version stays in the store and the log. A later re-validation whose rate reaches the floor presents its replay to the promotion path as the candidate the procedure was (`restoreRetired`, `packages/core/src/plane/promote.ts`): ADR 0026's replay rule (replay_k of replay_n), expiry, the write rule, the duplicate rule, the budget (`trust.protect_trusted`) and any gate later cards add to promotion (card D5's safety hold, card E2.19's approval) judge it. On allow it is the in-place promotion (version plus one, active) under `<policy>/drift/restored`; its own retirement is left out of the retired content it is judged against. Only a drift retirement is restored, told by its rule's suffix under any policy id; a ttl, eviction or supersession retirement is not, and an erased item is gone.

## Alternatives considered

- **Retire outright on a changed hash (ADR 0011's text).** Drops a procedure whose environment changed harmlessly; the replay is cached and cheap, so the plane can measure instead.
- **Retire below the admission rule (the card's text).** One noisy task out of five would retire a procedure; the minimum-trials amendment exists to avoid that, and the presets already set the floor.
- **Restore by a direct status rewrite.** Skips the promotion gate's checks (budget, expiry, later gates): review finding 3 of card D4.

## Consequences

- No registered preset, condition or result changes: drift is absent from every preset and registered config.
- The plane cannot verify the hash or the outcomes; a dogfood log replayed later knows only what the reasons record. Invariant 2's oracle does not yet judge a restore.
- Cards D5 and E2.19 judge a drift restore automatically, since it is a promotion.
- ADR 0011 carries a one-line pointer to this ADR.

## Sources

- `docs/decisions/0011-one-lifecycle-replay-admission.md`, `docs/decisions/0026-promotion-corroboration-and-review.md`, `docs/decisions/0046-replay-validation-source.md`, `docs/decisions/0010-retention-retires.md`
- `docs/readings/litreview/2605.19576-library-drift.md`, `docs/readings/litreview/2605.10990-skillguard-drift.md`
- `docs/log/2026-11-28-e2-14-finding-drift-rule-for-d4.md`, `docs/tasks/D4.md`
