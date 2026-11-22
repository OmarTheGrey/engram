# ADR 0045: The replay validation record's source: the plane derives it from the held-out outcomes a user-sourced actor presents

Status: proposed, 2026-11-21; revised 2026-11-22 by card D3's review fix pass (findings D3-3 and D3-6), and the same day for the lead's answers to findings D3-1 and D3-2 and the lead's reading of "3 seeds" (finding D3-13; `docs/tasks/lead-decisions.md`, item 63)
Deciders: drafted by card D3 of the absorb plan; for the lead's acceptance
Supersedes: nothing. It fills the slot ADR 0026 left open ("the plane passes none until card D3 gives it a source") and amends its sentence "The validation record is not a Plane argument".

## Context

- ADR 0011 admits a procedure only after a replay on held-out tasks passes k of n. ADR 0026 gave the evaluator a validation record `{ k, n }` and kept it off `Plane.promote`: a caller-supplied record would be a self-granted authority (Authorization Laundering, 2609.01836). Until card D3, no procedural candidate could become active through the plane.
- The replay must run outside core: core calls no model (AGENTS.md rule 4), and a replay is model sessions. So whatever reaches the plane is evidence the caller presents. The question is what that evidence is, and who may present it.
- The schema has no event that records a replay, and only card E2.8 changes `schema.ts` (rule 5).

## Decision

1. `PromoteOptions.replay` carries the replay itself: the item's id and the strict hash of the content it installed, the tasks the candidate was induced from, the threshold, and each held-out task's reward per seed without and with the candidate. It carries no k and n, but it does carry the per-task outcomes the count is made from, and the plane cannot verify those: they are the caller's evidence, not the plane's measurement.
2. The plane derives the record from it with core's pure `scoreReplay` (`packages/core/src/distill/validate.ts`), under the lead's rule of 2026-11-22 ("5 tasks, no worse"). A task passes when the candidate's mean reward over the seeds reaches the threshold and is not below the mean reward without it on that task. The plane computes both from the outcomes, which carry both arms per task and seed. k is the passing tasks and n the held-out tasks. The threshold and the baseline (tasks reaching it without the candidate) are reported beside them, so the event's reason carries the counts. The evaluator decides it against the policy's `replay_k` of `replay_n`.
3. A malformed replay is refused with `InvalidCallError` before the log is touched, like an invalid scope: no item id or content hash, a threshold other than the registered 2/3, seeds other than the registered 1, 2 and 3, a reward outside 0 to 1, the same task and seed twice, or tasks run on different seeds.
4. Only a user-sourced actor may present a replay (`engram/promote/validation-source`): the person who ran it. An agent presenting a replay of its own procedure is the self-granted authority ADR 0026 refuses.
5. The threshold is fixed in core at the registered 2/3 (`REPLAY_THRESHOLD`, the lead's answer "Fixed at 2/3" of 2026-11-22): at least 2 of 3 seeds for 0 or 1 rewards. It is not in the policy, whose promotion rule holds `replay_k` and `replay_n` only, and it is not a config field. The seeds are fixed the same way, at exactly 1, 2 and 3 (`REPLAY_SEEDS`, the lead's reading of "3 seeds" of 2026-11-22, review finding D3-13): a replay on one seed, or on seeds the caller picked, is malformed (point 3).
6. The replay is bound to the item (review finding D3-3). One run for another id, or for other content, is denied under `engram/promote/replay-item`. Its induction tasks must be exactly the tasks of the item's own distill ref (`distill:<method>:<sessions>`, card D2), which the plane names through a session index injected at construction (`PlaneDeps.distillTasks`, card D1's index). None of them may be replayed. Either failure is denied under `engram/promote/replay-split`, and so is a leaked split in the caller's own list (finding D3-6: a policy decision, so an event). An item with no distill ref was induced from no recorded session. A distill ref the plane cannot map is refused. Each decision's reason carries the replay's sha256 (`replayDigest`, the sha256 of its canonical JSON), so the log names the exact evidence it judged without a schema change.
7. No surface (the HTTP API, the MCP server, the CLI, the pi extension) may expose `replay` until verified actors (card E8.12, ADR 0042) are in place. Point 4 trusts the actor's source, and on a surface with self-asserted actors any caller could claim `user`.
8. A replay has exactly the policy's `replay_n` held-out tasks, drawn by the replay config's seed from the candidate's split (lead's answer to D3-1). One of any other size is denied under `engram/promote/replay-split`. That stops a caller reporting fewer or more tasks than the draw gives, but the draw stays the caller's: the plane holds no task pool and does not redo it, so a caller who draws by another seed, or redraws until a set suits it, is caught only by comparing the replay's tasks with the config's draw.

## Alternatives considered

- **A caller-supplied `{ k, n }`.** Rejected by ADR 0026; it also leaves the split and the threshold unchecked.
- **A replay event in the log, gathered by the plane.** The audit would be better (the invariants' oracle could judge a procedural promotion from the log alone), but it needs a new event kind or fields, which is a schema change.
- **Excluding the candidate's authors from presenting, as for a reviewer.** A candidate is written with the model or compaction source of its induction (card D2), so its writer acting as such is refused by point 4; the same person acting user-sourced, having run the replay, acts on their own authority, as a person who writes a procedure by hand does.
- **A threshold in the policy.** A new field is a schema change; a new key in the presets would change C3's policy text and so every registered C3 cache key. The lead fixed it in core instead.
- **A pass on the threshold alone.** The first draft of this ADR passed a task at the threshold whatever the baseline did. The lead's rule adds "no worse": a candidate that reaches 2/3 where the agent already reached 1 does not help on that task.

## Consequences

- `Plane.promote` admits a procedural candidate for the first time; the promote event's reason reads, for example, "the validation record 4 of 5 held-out tasks pass with the procedure (a mean reward of at least 2/3 over the seeds, and no lower than without it; 2 of 5 reach 2/3 without it) meets 4 of 5; replay sha256:<hex>".
- The plane trusts the outcomes as presented: a user who invents them is believed. That is the same trust a user-typed write gets, and the runner's cassettes make a fixture's outcomes reproducible.
- The invariants' oracle (`promotionPermitted`, `packages/core/src/oracle.ts`, the lead's) takes the presented replay and the session index, and judges a replay admission by its own reading (`replayAdmits`). Invariant 2 presents replays (review finding D3-5). The replay itself is still not in the log: the oracle judges what the test presented, and a dogfood log replayed later cannot be judged on it.
- Cherry-picking held-out tasks is narrowed by point 8, not closed: a replay covers exactly `replay_n` tasks on the registered seeds, and the runner draws them by the config's seed, but the draw stays the caller's (point 8).
- Drafted as 0042 and renumbered 0045 the same day: cards E8.12 and E8.13 and the TUI design hold 0042 to 0044.

## Sources

- `docs/decisions/0011-one-lifecycle-replay-admission.md`, `docs/decisions/0026-promotion-corroboration-and-review.md`
- `docs/readings/litreview/2605.19576-library-drift.md`
- `docs/tasks/D3.md`
