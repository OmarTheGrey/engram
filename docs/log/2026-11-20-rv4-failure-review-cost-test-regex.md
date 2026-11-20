---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/adopt-review.test.ts
supersedes: none
---

**What.** The first run of the I-7 cost test, after the fix, counted 85 rows against a bound of 5.

**Why.** Its counter matched any statement with `scope_from = ? AND op = 'retire'`, which also matches the erasure-mark queries in `commit.ts` that every write runs.

**Result.** The counter now matches only the erased-content queries, the one before this pass (`AND item_id IS NOT NULL`) and the one after (`AND seq > ?`): 200 rows before the fix, at most 5 after.

**Consequence.** None for the code.
