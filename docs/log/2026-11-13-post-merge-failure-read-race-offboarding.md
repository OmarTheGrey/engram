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

**Result.** Reproduced with a fake store whose search runs the offboarding before answering. Fixed: after the search, the read runs in one transaction holding the log's write lock, selects the projection's ids again with a parameter-free query, drops erased items, and only then filters, scores, ranks, cuts and appends. An erasure commits under the same lock in any process, so the read equals one run after it.

**Consequence.** An item rewritten, not erased, meanwhile is returned at its snapshot version, as before.
