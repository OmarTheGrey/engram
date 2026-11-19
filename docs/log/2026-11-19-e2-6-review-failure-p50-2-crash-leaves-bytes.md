---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-review.test.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** Review finding P50-2 (orderings RV3 to RV5): a writer that threw between its store write and its commit, or whose repair's delete failed, left an erased id's bytes, or a never-committed record, in the person scope for good, and the next adoption could take the latter in.

**Why.** The protocol assumed every store write is followed by its writer's check; a crash or a failed repair breaks that.

**Result.** RV3, RV4 and RV5 failed before the fix and pass after on both backends.

**Consequence.** Closed by deleting such records at adoption; ADR 0007 and ADR 0010 say so.
