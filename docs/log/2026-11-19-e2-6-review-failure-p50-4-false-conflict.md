---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-review.test.ts
  - packages/core/src/plane/commit.ts
supersedes: none
---

**What.** Review finding P50-4 (ordering RV7): a gate's deny of another member's write under the item's id made the owner's pending grant change stale, a false conflict.

**Why.** The first pass counted every write, update, promote, retire or evict event as a change, whatever its decision.

**Result.** RV7 failed before the fix and passes after.

**Consequence.** Closed; see the decision on what counts as a change.
