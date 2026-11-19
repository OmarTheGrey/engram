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
  - docs/decisions/0007-write-gate-and-source-isolation.md
supersedes: none
---

**What.** Review finding P50-1 (ordering RV8): a stale rewrite's bytes, adopted as the owner's import before the writer's check, brought a removed grant back, because settling then wrote the adopted version back.

**Why.** The first pass recorded this as a limit and left it; the card's goal names exactly this case, and `engram read` adopts before every read.

**Result.** RV8 failed on branch e2-6 before the fix (Sam read the item) and passes after, on SQLite and embedded Postgres.

**Consequence.** Closed; see the decision on withdrawing an adoption of a stale write.
