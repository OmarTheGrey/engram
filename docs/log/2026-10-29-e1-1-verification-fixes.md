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
  - packages/core/test/db/postgres.test.ts
  - packages/core/test/db/backends.test.ts
  - docs/decisions/0024-db-backends-synchronous-contract.md
  - "pnpm --filter core exec vitest run test/db/postgres.test.ts test/db/backends.test.ts"
supersedes: none
---

**What.** The four minor findings of the fix pass's verification (P2-11 to P2-14) on the Postgres backend.

**Why.** An idle-in-transaction timeout was reported as a lost connection; a fractional numeric lost precision; the pool's session reset was untested; a server timeout was recognised by its English message.

**Result.** Four new tests failed on the previous head and pass now: the idle timeout names its cause and closes the Db; `12345678901234567.89` reads back as its exact text; `isServerTimeout` decides by SQLSTATE 57014 and the elapsed time. The new pool test passed already and fails with `DISCARD ALL` removed (`lock_timeout` stays `1234ms`).

**Consequence.** ADR 0024's amendments state when a timeout keeps the Db and when it ends it.
