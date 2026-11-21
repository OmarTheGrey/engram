---
date: 2026-11-21
author: claude-agent
type: change
card: E2.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - packages/core/test/property/cedar.test.ts
  - "make test-one T=packages/core/test/property/cedar.test.ts"
supersedes: docs/log/2026-11-21-e2-12-differential-test.md
---

**What.** The fix pass for the five findings of E2.12's independent review, each test first.

**Why.** The review showed the differential test missed defects (`2026-11-21-e2-12-failure-review-findings.md`).

**Result.**
- E2.12-1: unique rule ids, and a duplicated-rules property.
- E2.12-2: a scope-before-grant check.
- E2.12-3: write grants flattened and generated.
- E2.12-4: the policy id reaches comments only as a Cedar string, with line separators escaped.
- E2.12-5: `cedarInstant` refuses an instant off the calendar; the coverage guard samples its own cases; `ENGRAM_CEDAR_RUNS` and `ENGRAM_CEDAR_SEED_OFFSET` set the runs and seeds.

The test has 23 tests:
- 1,500 runs per preset property;
- 1,000 generated policies;
- 150 duplicated-rule policies of 20 reads and 20 writes.

The new tests of E2.12-3, 4 and 5 failed on the old code. Those of E2.12-1 and 2 failed on the mutants the review named, which the old tests let pass. The mutant results are in `2026-11-21-e2-12-finding-mutants-after-review.md`.

**Consequence.** No disagreement stands; none needed a characterisation test.
