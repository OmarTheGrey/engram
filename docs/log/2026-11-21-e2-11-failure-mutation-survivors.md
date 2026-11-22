---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.11
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/counterexamples/trust.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** Two mutations survived invariant 8: dropping adoption's keep-the-trusted-item line, and dropping the decision-time budget refusal.

**Why.** The oracle exempted every retire event, and the commit-time recheck refuses the same write later, so the outcome was the same.

**Result.** The oracle now judges adoption's retraction after a denied edit at the adopter's kind, and the trust file checks that `checkWrite` reports the refusal and that a write is refused at the decision, never after the store is written. Both mutations now fail.

**Consequence.** Both pieces are pinned.
