---
date: 2026-11-13
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/offboard-edges.test.ts
  - packages/core/src/plane/read.ts
supersedes: none
---

**What.** A read in flight during offboarding returned erased content and wrote explanation rows for erased items after the erasure.

**Why.** Card E2.2's read snapshots the projection, awaits the store's search, then appends its event outside the write queue; card E9.7's offboarding runs in the write queue and could finish in that gap.

**Result.** Reproduced with a fake store whose search runs the offboarding before answering. Fixed: after the await the read keeps only items the projection still holds, and nothing awaits between that check and the transaction that appends the read event, so no item erased before the event is returned or recorded. The read reason's counts stay consistent, since the erased items are dropped before the filter runs.

**Consequence.** An item rewritten, not erased, during the gap is still returned at its snapshot version; that is unchanged and reveals nothing new.
