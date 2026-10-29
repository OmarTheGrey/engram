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
  - packages/core/test/db/contract.ts
  - packages/core/test/db/postgres.test.ts
  - docs/decisions/0024-db-backends-synchronous-contract.md
  - "pnpm --filter core exec vitest run test/db test/unit/events.test.ts test/unit/items.test.ts test/replay"
supersedes: none
---

**What.** Card E1.1's Postgres backend: `openPostgres(url)` runs the synchronous `Db` on a worker thread with `Atomics.wait`, a `DbTimeoutError` and an advisory lock on the outer transaction.

**Why.** ADR 0024: the swap ADR 0003 promised stayed untested, and a shared log must serialise writers in different processes, which SQLite's write queue cannot.

**Result.** The contract suite (18 cases) failed 4 cases on a deliberately broken SQLite wrapper, then passed on SQLite and on an embedded Postgres 17; the event, item and replay tests pass on both (131 tests). Two processes appending 150 events each produce seq 0 to 299; without the lock one stops on a duplicate `events_pkey`. Breaking the placeholder rewrite fails 6 tests; removing the timeout lets `pg_sleep(5)` block.

**Consequence.** PR 3 can open Postgres from the CLI through `openPostgres`.
