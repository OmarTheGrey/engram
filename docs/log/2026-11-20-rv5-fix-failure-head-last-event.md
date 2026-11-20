---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
  - packages/core/test/unit/plane/read-time.test.ts
supersedes: none
---

**What.** Review of PR #59, RV5-2: `accessTime` took the head as the ts of the highest-seq event, so a write appended with an earlier ts moved the head back and a read named before a grant's expiry returned the item again, with the dogfood report counting no violation.

**Why.** The log's seq order and ts order differ whenever a caller's clock runs behind the log; the RV5 fix assumed they agree.

**Result.** Reproduced red in read-time.test.ts on SQLite and embedded Postgres (`expected '2026-11-19T00:00:00Z' to be '2027-01-10T00:00:00Z'`); fixed by the high-water mark (rv5-fix-decision-head-high-water-mark).

**Consequence.** ADR 0005's and 0027's amendments now say what holds: no read is judged before the latest ts the log holds.
