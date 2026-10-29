---
date: 2026-10-29
author: claude-agent
type: change
card: E1.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/db/postgres.ts
  - packages/core/src/db/postgres-worker.ts
  - packages/core/src/db/transaction.ts
  - packages/core/test/db/postgres.test.ts
  - packages/core/test/db/contract.ts
  - docs/decisions/0024-db-backends-synchronous-contract.md
  - "pnpm --filter core exec vitest run test/db test/unit/events.test.ts test/unit/items.test.ts test/replay"
supersedes: none
---

**What.** The review fix pass on the Postgres backend (findings P2-1 to P2-10): a pinned connection whose loss closes the Db, worker failures reported at once, rollback of a failed begin, server-side timeouts, value mapping, a stricter placeholder rewrite, and test hygiene.

**Why.** The review showed a dropped connection half-commits a transaction through postgres.js's reconnect, and a timed-out writer kept the log's lock.

**Result.** 17 new or changed tests failed on the reviewed head and pass now (157 in the acceptance set). Mutations: making connection loss non-fatal fails the terminate test; removing the begin rollback leaves "current transaction is aborted"; dropping the server timeouts fails two timeout tests; removing the client wait fails the backstop test.

**Consequence.** ADR 0024's amendments list the remaining dialect differences.
