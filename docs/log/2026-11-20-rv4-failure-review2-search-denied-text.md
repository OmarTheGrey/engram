---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/rv4-review.test.ts
  - packages/core/src/plane/read.ts
supersedes: none
---

**What.** Verification finding N-1 of PR #58, opened by the I-3 fix: a search ranked the kept item by text the gate denied. With team review off (P30b), Lee searched `hunter2` and got Dana's team item back, though the word was only in her denied edit of the file.

**Why.** I-3 keeps the plane's approved version while the file holds the denied edit. `Plane.read` orders hits by the adapter's search over store records, and restated a hit only when the projection's content had changed since the snapshot, never when the store's record differs from the projection.

**Result.** A hit whose record no longer holds the projected content is now matched by the plane over the projected content (decision entry). P30b: `hunter2` finds nothing for Lee or Dana; `tuesdays` still finds the item.

**Consequence.** The same rule covers the I-4 strip and any record edited outside the plane.
