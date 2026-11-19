---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/read.test.ts
  - packages/core/test/unit/plane/promote.test.ts
supersedes: none
---

**What.** Refusing a grant of another class than the item's on every first write failed seven tests, six of them existing tests of other cards.

**Why.** The read filter's tests write such grants on purpose to show they admit no read, the read pipeline property generates them, and promotions P5-7 and P5-15 carry an episodic grant onto a semantic version.

**Result.** The class check runs only on grants a change adds; the existing tests pass unchanged.

**Consequence.** Decision `2026-11-19-e9-4-review-decision-m1-first-writes.md`.
