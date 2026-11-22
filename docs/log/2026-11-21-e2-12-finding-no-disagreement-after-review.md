---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.12
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/cedar.test.ts
  - "ENGRAM_CEDAR_RUNS=20000 ENGRAM_CEDAR_SEED_OFFSET=7 make test-one T=packages/core/test/property/cedar.test.ts"
supersedes: docs/log/2026-11-21-e2-12-finding-no-disagreement.md
---

**What.** After the review fix pass, the Cedar engine and Engram's evaluator still disagree on no generated request in the claimed scope, write grants now included.

**Why.** The superseded entry's 20,000-run agreement came from an uncommitted edit of the test and could not be rerun; the review asked for a committed way to run it.

**Result.** The committed run passes 23 of 23. So does the large run, now set by environment: 20,000 runs per preset property, 13,334 generated policies and 2,000 duplicated-rule policies of 20 reads and 20 writes, seeds offset by 7. It passed 23 of 23 in 338.84 s on the merged branch. The first pass's review found one real disagreement, a co-member's rewrite of a granted item. It came from the export, not the evaluator, and the export now agrees.

**Consequence.** No characterisation test is pinned, since no disagreement stands.
