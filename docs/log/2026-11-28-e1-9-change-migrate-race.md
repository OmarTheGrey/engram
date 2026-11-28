---
date: 2026-11-28
author: claude-agent
type: change
card: E1.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/db/migrate.ts
  - packages/core/test/unit/db/migrate-race.test.ts
  - "make test-one T=packages/core/test/unit/db/migrate-race.test.ts"
supersedes: none
---

**What.** `migrate` creates schema_migrations inside a transaction and re-reads each migration inside the transaction that applies it, skipping one another process applied.

**Why.** Card E1.6's verification found two processes opening one fresh log could fail with "table events already exists" (docs/log/2026-11-21-e1-6-verify-finding-migrate-race.md).

**Result.** Before: the deterministic interleave failed on SQLite ("table events already exists") and Postgres ("relation events already exists"), and four racing processes failed on Postgres. After: 4 of 4 pass. Removing the re-read alone fails 3 of 4 (mutation check). `make test-one T=packages/core/test/unit/db/migrate.test.ts` still passes 7 of 7.

**Consequence.** A single process applies and returns exactly what it did before, so no log changes. Card E9.11's migration needs nothing from this.
