---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-review.test.ts
  - packages/core/src/plane/commit.ts
supersedes: none
---

**What.** Review finding P50-5 (ordering RV1b): a second offboarding's report closed the first one's begin mark while the first was still erasing, so a write into the person scope was allowed in that window.

**Why.** An erasure was open while the last begin mark followed the last report, whichever offboarding each belonged to.

**Result.** RV1b failed before the fix and passes after.

**Consequence.** Closed; see the decision on matching each mark with its report.
