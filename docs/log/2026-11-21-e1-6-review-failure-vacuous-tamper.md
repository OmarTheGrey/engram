---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/chain.test.ts
supersedes: none
---

**What.** The new tamper "every salt deleted" verified OK in a run where every salted event had been erased.

**Why.** Deleting no rows is no tamper; the tamper had no Skip for an empty candidate set.

**Result.** It skips when no salt exists; the guard still requires it met in some run on each backend.

**Consequence.** Each tamper declares when it has no candidate.
