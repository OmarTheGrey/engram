---
date: 2026-11-22
author: claude-agent
type: failure
card: E2.11
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** Invariant 8's walk had no promotion and no second handle, so it could not see the commit-time rechecks (review E2.11-2); its `floored` guard also counted writes that had claimed `external` already (E2.11-6).

**Why.** The walk drove one handle, whose queue orders every write.

**Result.** With promotions and races added, the first version still passed with the promotion recheck reverted: no race aimed a write at a promotion's target. Races now may aim a person's write there, and a guard requires a promotion refused at its commit.

**Consequence.** Recorded in `invariant-8-races`.
