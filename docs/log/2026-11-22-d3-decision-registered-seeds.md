---
date: 2026-11-22
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/validate.ts
  - packages/core/test/unit/distill/validate.test.ts
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** Core fixes a replay's seed set at exactly 1, 2 and 3 (`REPLAY_SEEDS`). Any other set is an `InvalidCallError` before the log, like the threshold. This is the lead's reading of "3 seeds" of 2026-11-22 (review finding D3-13).

**Why.** The plane admitted a replay on one seed, or on seeds a caller picked, such as 4, 7 and 9 or the best 3 of 10. The runner config allowed any number of seeds.

**Result.** Unit tests refuse a one-seed replay and seeds 4, 7, 9. The oracle refuses any set but 1, 2, 3. Invariant 2's one-seed cases must throw with the log unchanged, and removing the check fails it. The runner config requires exactly [1, 2, 3].

**Consequence.** ADR 0045 points 3 and 5 and lead-decisions item 63 record it.
