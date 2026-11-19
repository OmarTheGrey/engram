---
date: 2026-11-19
author: claude-agent
type: change
card: E2.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle.test.ts
  - packages/adapters/test/plane/cross-handle-files.test.ts
supersedes: none
---

**What.** The verifier's reproductions R1 to R9 and the orderings R10 to R15 found here are committed tests on two handles of one log, on both backends, with a files-adapter case on one log file over one memory folder.

**Why.** Card E2.6's acceptance asks that each reproduction be a test that fails on main and passes after the fix.

**Result.** On main 13 of 20 orderings per backend fail (R1, R5, R6, R7, R8, R14 and the R9 control pass); all 22 per backend pass on branch e2-6. Each of eight mutations of the fix fails its test on both backends.

**Consequence.** None.
