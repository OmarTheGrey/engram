---
date: 2026-11-28
author: claude-agent
type: finding
card: E1.9
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/db/migrate-race.test.ts
  - packages/core/src/db/migrate.ts
supersedes: none
---

**What.** On Postgres the first failure of concurrent migration was not "events already exists" but "duplicate key value violates unique constraint pg_type_typname_nsp_index", from two concurrent CREATE TABLE IF NOT EXISTS schema_migrations.

**Why.** Running the race before the fix.

**Result.** IF NOT EXISTS is not safe under concurrency on Postgres; creating the table inside a transaction that takes the log's advisory lock serialises it. After the fix 4 racers pass 6 rounds.

**Consequence.** Any later CREATE ... IF NOT EXISTS outside migrate should run under the same lock.
