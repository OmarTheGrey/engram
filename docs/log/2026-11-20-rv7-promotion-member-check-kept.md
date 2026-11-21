---
date: 2026-11-20
author: claude-agent
type: decision
card: RV7
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
supersedes: none
---

**What.** `reviewerProblem`'s check that the reviewer is a member of the target stays, with a comment marking it as defence in depth (core review finding RV-CORE-9).

**Why.** Inside `evaluatePromotion` it never decides: the promoted item is first judged as a write into the target, and that membership check refuses a non-member. But `reviewerProblem` is exported, and the check is ADR 0026's rule as written, so removing it would leave any other caller without it.

**Result.** Comment only, no behaviour change.

**Consequence.** Nothing.

