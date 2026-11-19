---
date: 2026-11-19
author: claude-agent
type: change
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - packages/core/src/plane/commit.ts
  - packages/core/test/unit/plane/cross-handle.test.ts
supersedes: none
---

**What.** Offboarding appends an `engram/offboard/begin` event before deleting any store record, and until its report event closes it, writes, grant changes, promotions and adoptions into that person scope are refused under `engram/offboard/erasing`.

**Why.** Offboarding deleted the records first and committed the erasure later, re-checking nothing, so a grant change or rewrite on another handle in that window rewrote the erased record (ordering R2).

**Result.** R2 and its rewrite and adoption variants fail on main and pass here; the store, a rebuild, the next adoption and every read hold nothing of the erased item.

**Consequence.** A crash between the mark and the report freezes the person scope until offboarding runs again; the deletion report's `events` now begin with the mark.
