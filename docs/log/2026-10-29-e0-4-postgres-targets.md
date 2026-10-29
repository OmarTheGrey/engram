---
date: 2026-10-29
author: claude-agent
type: change
card: E0.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/setup.ts
  - packages/cli/test/postgres.ts
  - packages/cli/test/setup.test.ts
  - packages/cli/test/doctor.test.ts
  - test/e2e/cli.e2e.test.ts
  - "make test-e2e"
supersedes: none
---

**What.** Card E0.4, phase 2: Postgres targets (`--db postgres://...` or `ENGRAM_DB_URL`) now open through core's `openPostgres` (card E1.1), and doctor and the CLI smoke run on embedded Postgres as well as SQLite.

**Why.** Phase 1 refused Postgres targets until PR 2 landed. ADR 0024 asks layer 6 to cover both backends, and the lead ruled out Docker.

**Result.** Doctor finds a Postgres log by its migrations table without creating one. Every error or label shows the URL with its password as `***`. Each CLI and e2e Postgres test gets its own database and role. 97 CLI tests pass, and `make test-e2e` passes 10 steps (5 per backend) in about 21 s. The output never contains the role's password.

**Consequence.** E0.4 is complete pending review. The CLI and e2e projects use core's globalSetup by relative path.
