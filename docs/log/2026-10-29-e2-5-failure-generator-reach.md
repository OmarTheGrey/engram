---
date: 2026-10-29
author: claude-agent
type: failure
card: E2.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** After the P5 fixes, invariant 2's promotion guards were not met: one landing by confirmation in 1000 cases, and no duplicate or same-actor refusal.

**Why.** Reach now follows the random read matrix, which rarely lets the promoter read the item. The generator's restatements also differed in case, so they never confirmed under the strict normal form. Its restatements never sat in the target, so no duplicate could arise.

**Result.** An opened case also opens the read matrix for person and team contexts. Restatements differ in spacing and a zero-width space, and in case only a third of the time. Some are written into the target as the promoted class, and the promoter is user-sourced more often. Every guard is met. The property itself held throughout, and one counterexample came from the oracle's retired-content list missing the P5-6 rule.

**Consequence.** None beyond the generator change.
