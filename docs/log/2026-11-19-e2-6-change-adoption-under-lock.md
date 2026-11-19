---
date: 2026-11-19
author: claude-agent
type: change
card: E2.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/retention.ts
  - packages/core/test/unit/plane/cross-handle.test.ts
supersedes: none
---

**What.** Adoption decides and commits each record in one transaction, leaves records the log changed after its listing to the next adoption, and never adopts an erased id again; a retention sweep and the budget check decide and commit in one transaction.

**Why.** An adoption that listed the store before an offboarding brought the erased item back (R10), one whose decision another process overtook did the same (R13), and one that listed before a grant change retired the changed item (R11).

**Result.** R10, R11 and both R13 cases fail on main and pass here; the erased-id refusal has its own test.

**Consequence.** `engram read`, which adopts before every read, can run beside `engram serve` on one workspace.
