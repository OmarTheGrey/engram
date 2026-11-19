---
date: 2026-11-20
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/promote.ts
supersedes: none
---

**What.** Finding V4-1: a first write whose lineage named an erased item, decided before the mark, committed after the erasure without any crash (probes P8 and P8b).

**Why.** The lineage refusal ran only at the decision; the check under the lock read the item's own id and scope, not its lineage.

**Result.** P8 and P8b failed before the fix and pass after on SQLite and embedded Postgres: the commit now checks the lineage and refuses under `engram/write/erased`, and a promotion's new version is checked the same way.

**Consequence.** Any later path that commits a new item carrying a lineage needs the same check.
