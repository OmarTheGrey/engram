---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/test/unit/plane/adopt.test.ts
supersedes: none
---

**What.** Adoption's test that a denied store version retires the projected item failed: the stale-listing rule counted adoption's own deny event as a change since the listing and skipped the retraction.

**Why.** The rule compared against the head before the listing, which adoption's own events also pass.

**Result.** The retraction after a deny now checks for changes since that deny's seq; the test passes.

**Consequence.** None.
