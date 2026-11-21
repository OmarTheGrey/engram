# ADR 0042: The replay validation record's source: the plane derives it from the held-out outcomes a user-sourced actor presents

Status: proposed, 2026-11-21
Deciders: drafted by card D3 of the absorb plan; for the lead's acceptance
Supersedes: nothing. It fills the slot ADR 0026 left open ("the plane passes none until card D3 gives it a source") and amends its sentence "The validation record is not a Plane argument".

## Context

- ADR 0011 admits a procedure only after a replay on held-out tasks passes k of n. ADR 0026 gave the evaluator a validation record `{ k, n }` and kept it off `Plane.promote`: a caller-supplied record would be a self-granted authority (Authorization Laundering, 2609.01836). Until card D3, no procedural candidate could become active through the plane.
- The replay must run outside core: core calls no model (AGENTS.md rule 4), and a replay is model sessions. So whatever reaches the plane is evidence the caller presents. The question is what that evidence is, and who may present it.
- The schema has no event that records a replay, and only card E2.8 changes `schema.ts` (rule 5).

## Decision

1. `PromoteOptions.replay` carries the replay itself: the tasks the candidate was induced from, the threshold, and each held-out task's reward per seed without and with the candidate. It never carries a record.
2. The plane derives the record from it with core's pure `scoreReplay` (`packages/core/src/distill/validate.ts`): a task passes when its mean reward with the candidate is at or above the threshold; k is the passing tasks, n the held-out tasks, with the threshold and the baseline (tasks passing without the candidate) beside them so the event's reason carries the counts. The evaluator decides it against the policy's `replay_k` of `replay_n` as before.
3. A replay the plane cannot judge is refused with `InvalidCallError` before the log is touched, like an invalid scope: a replayed task the candidate was induced from (leakage), a reward outside 0 to 1, the same task and seed twice, or tasks run on different seeds.
4. Only a user-sourced actor may present a replay (`engram/promote/validation-source`): the person who ran it. An agent presenting a replay of its own procedure is the self-granted authority ADR 0026 refuses.
5. The threshold is the replay's, stated by its caller (the runner's config), since the policy's promotion rule holds `replay_k` and `replay_n` only.

## Alternatives considered

- **A caller-supplied `{ k, n }`.** Rejected by ADR 0026; it also leaves the split and the threshold unchecked.
- **A replay event in the log, gathered by the plane.** The audit would be better (the invariants' oracle could judge a procedural promotion from the log alone), but it needs a new event kind or fields, which is a schema change.
- **Excluding the candidate's authors from presenting, as for a reviewer.** A candidate is written with the model or compaction source of its induction (card D2), so its writer acting as such is refused by point 4; the same person acting user-sourced, having run the replay, acts on their own authority, as a person who writes a procedure by hand does.
- **A threshold in the policy.** A new field is a schema change; a new key in the presets would change C3's policy text and so every registered C3 cache key.

## Consequences

- `Plane.promote` admits a procedural candidate for the first time; the promote event's reason reads, for example, "the validation record 4 of 5 held-out tasks at or above 1 with the procedure (2 of 5 without it) meets 4 of 5".
- The plane trusts the outcomes as presented: a user who invents them is believed. That is the same trust a user-typed write gets, and the runner's cassettes make a fixture's outcomes reproducible.
- The invariants' oracle (`promotionPermitted`, `packages/core/src/oracle.ts`, the lead's) still says a procedural candidate never lands, which stays sound because the invariants never present a replay. Extending invariant 2 to replays needs the oracle to see the replay, which this ADR does not record in the log.
- Once candidates carry their sessions (card D2's `distill:<method>:<sessions>` ref), the plane could check `induced_from` against the candidate's own ref instead of taking the caller's list.
- The number 0042 was free on main when drafted; a parallel card may claim it first, and then this file is renumbered.

## Sources

- `docs/decisions/0011-one-lifecycle-replay-admission.md`, `docs/decisions/0026-promotion-corroboration-and-review.md`
- `docs/readings/litreview/2605.19576-library-drift.md`
- `docs/tasks/D3.md`
