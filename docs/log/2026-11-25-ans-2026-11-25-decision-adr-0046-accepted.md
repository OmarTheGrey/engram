---
date: 2026-11-25
author: claude-agent
type: decision
card: ANS-2026-11-25
chapter: design
pillar: distill
hypothesis: none
evidence:
  - docs/decisions/0046-replay-validation-source.md
  - docs/tasks/lead-decisions.md
  - packages/core/src/distill/validate.ts
  - packages/core/test/unit/distill/validate.test.ts
supersedes: none
---

**What.** ADR 0046 (the replay validation record's source) is accepted by the lead, item 63 (a), as written.

**Why.** The lead wrote "accept the adrs" on 2026-11-25: his own answer, not one under the delegation, option (a) of each item.

**Result.** The text matches option (a) and already carries the lead's answers to D3-1, D3-2 and D3-13. The plane counts k of n itself with `scoreReplay`, the threshold 2/3 and seeds 1, 2 and 3 are fixed (`REPLAY_THRESHOLD`, `REPLAY_SEEDS` in `packages/core/src/distill/validate.ts`), only a user-sourced actor presents (`engram/promote/validation-source`), and the binding to id, hash and distill ref is denied under `replay-item` and `replay-split`. Tested in `packages/core/test/unit/distill/validate.test.ts` and `packages/core/test/unit/policy/promotion.test.ts`.

**Consequence.** No text change. Decision 7 (no surface exposes `replay`) holds by omission only (finding of the same date).
