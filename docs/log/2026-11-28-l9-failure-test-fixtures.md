---
date: 2026-11-28
author: claude-agent
type: failure
card: L9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/lint/evidence.test.ts
supersedes: none
---

**What.** The first run of `evidence.test.ts` failed 8 of 24 tests.

**Why.** The test's four items were all semantic and shared words, so the contradiction lint paired every two of them (7 units, not the 2 the assertions assumed); and the loader test's policy had write and read rules for the person level only, which the loader refuses.

**Result.** The incident and its claim were made episodic, so only the Friday and Monday items pair, and the loader policy names all four levels. 24 passed on the rerun; the implementation did not change.

**Consequence.** None.
