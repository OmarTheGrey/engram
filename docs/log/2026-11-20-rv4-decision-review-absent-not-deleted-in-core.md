---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - packages/core/src/events.ts
  - docs/decisions/0010-retention-retires.md
supersedes: none
---

**What.** I-1 is fixed in core, with the adapter contract unchanged: the erasure reads each ref before deleting it, and a ref the store holds no record at is recorded as not proven deleted.

**Why.** The finding allowed core or a contract change. The contract already has `read`, which tells absent from present on every adapter, so no adapter and no conformance test needed changing. A read that throws means a record is there, and the delete proceeds.

**Result.** The erase event carries `NOT_FOUND_CLAUSE` beside `LEFT_CONTENT_CLAUSE` with the erased versions' merging hashes, and adoption refuses that content in the person scope under any id.

**Consequence.** One more store call per erased ref. If wrong (a store whose read misses what delete would remove), its records are erased from the plane but their hashes kept, the safe direction.
