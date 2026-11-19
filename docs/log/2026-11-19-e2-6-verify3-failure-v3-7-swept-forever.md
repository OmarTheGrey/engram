---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/src/events.ts
supersedes: none
---

**What.** Finding V3-7: a record the sweep could not delete because the store refuses for good was refused forever, even after the person edited it.

**Why.** The swept event recorded no content hash, unlike an erasure's left-in-store record.

**Result.** The V3-7 test failed before the fix and passes after.

**Consequence.** None.
