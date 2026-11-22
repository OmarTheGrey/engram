---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/cedar.test.ts
  - packages/core/src/policy/cedar.ts
supersedes: none
---

**What.** The independent review of the first pass found five defects the differential test and my own mutation checks had missed.

**Why.** I mutated only the conditions I had written, not the bookkeeping around them, and never sought a request outside what the generators drew.

**Result.**
- E2.12-1: deleting either deduplication line passed every test, since duplicate ids overwrote each other in the test's policy map.
- E2.12-2: an evaluator preferring a grant over a readable scope passed every test.
- E2.12-3: a co-member's rewrite of a granted item was allowed by Cedar and denied by the evaluator; the write generator carried no grants, so it was never drawn.
- E2.12-4: a line break in a policy id injected a Cedar policy through a comment.
- E2.12-5: `cedarInstant` encoded `2026-13-01` as NaN.

**Consequence.** Each was fixed test first in the fix pass (`2026-11-21-e2-12-change-review-fix-pass.md`).
