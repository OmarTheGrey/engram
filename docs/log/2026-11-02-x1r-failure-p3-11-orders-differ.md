---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/retrieval.test.ts
supersedes: none
---

**What.** C2 to C4 showed items in the store's order and C5 in the plane's score order, so the same items reached the model in different orders.

**Why.** PR 3 shared retrieval between conditions but not ordering.

**Result.** One per-item ordering rule from core serves every condition.

**Consequence.** Found by the independent review of PR #25 and fixed in its review fix pass.
