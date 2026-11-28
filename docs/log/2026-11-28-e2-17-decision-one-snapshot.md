---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/explain-absent.ts
supersedes: none
---

**What.** The access time and the projection are taken together in one transaction, under the log's lock, and both the entitlement and every stage are computed from that one projection (review finding E2.17-2).

**Why.** Two projections a write could land between could give a stage no single read would give.

**Result.** The store's search, awaited after the lock is released, matches the snapshot's items as the read's own search does; a write landing meanwhile is not seen. The cost is one short lock per answer, as a read takes.

**Consequence.** None for the read.
