---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/db/schema-v1.test.ts
  - packages/core/src/db/migrate.ts
supersedes: none
---

**What.** Migration 6 broke the schema-v1 test on SQLite and Postgres.

**Why.** The test asserted that migrating a version 0 log applies exactly `[4]`, which holds only while 4 is the last migration.

**Result.** The run failed with "expected [ 4, 6 ] to deeply equal [ 4 ]" (`pnpm --filter @engram/core exec vitest run test/db/schema-v1.test.ts`). The test now expects migration 4 and every later one, taken from `MIGRATIONS`, and its bodies checks are unchanged. Run with the db contract and backend tests: 51 passed.

**Consequence.** Card E1.6's migration 5 would have hit the same assertion; the test now survives it.
