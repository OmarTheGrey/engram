---
date: 2026-10-29
author: claude-agent
type: failure
card: E1.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/db/postgres-worker.ts
  - packages/core/test/db/postgres.test.ts
supersedes: none
---

**What.** The first Postgres backend let a transaction half-commit after its connection dropped, and let a timed-out writer keep the log's advisory lock.

**Why.** postgres.js reconnects transparently: after `pg_terminate_backend`, the next statements ran in a new session with no BEGIN, no lock and no search path, and the final COMMIT was only a warning. Separately, terminating the worker on a client timeout does not stop a busy backend, so its transaction and lock outlived the Db.

**Result.** Found by the independent review; the first suite never dropped a connection or timed out in a transaction. Both are now tests: the terminate probe expects the transaction to throw and no rows in either schema, and a second writer must get the lock within 3 s of the first one's timeout.

**Consequence.** A backend test suite needs fault cases (dropped connection, failed begin, timeout in a transaction), not only the happy contract.
