---
date: 2026-11-21
author: claude-agent
type: change
card: E1.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/crash-windows.test.ts
  - "make test-one T=packages/core/test/unit/plane/crash-windows.test.ts"
supersedes: none
---

**What.** `crash-windows.test.ts` has one case per store-then-log window: the write path (W1 to W6, grant changes G1 and G2), the offboarding (O1 to O8: mark, handover, erasure delete and commit, sweep listing and delete, report, a transient delete failure) and the adapter-delete paths (D1 to D5: adoption's purge, a stale writer's settling).

**Why.** Card E2.6's windows were tested only where a reviewer thought to look.

**Result.** Each case stops one handle at a failpoint, opens the next on another connection to the same log and store, shows what it sees, and runs recovery to a fixed point: a second adoption appends nothing, the store holds no record the log never allowed, nothing erased returns. 51 of 51 pass on SQLite and Postgres, 26.9 s. Mutation check: a write gate ignoring an open erasure fails O1 to O7.

**Consequence.** Two windows do not recover fully: findings E14-F1 and E14-F2.
