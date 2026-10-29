---
date: 2026-10-29
author: claude-agent
type: decision
card: E1.1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/db/embedded-postgres.ts
  - packages/core/test/db/global-setup.ts
  - packages/core/test/db/backends.ts
  - docs/decisions/0024-db-backends-synchronous-contract.md
  - docs/deps.md
supersedes: none
---

**What.** Postgres for tests comes from `embedded-postgres` 17.10.0-beta.17, started once per core test run by a vitest globalSetup, not from a CI service container.

**Why.** The lead's instruction of 2026-10-29: no test, gate or CI step may need Docker. The package ships Postgres 17 binaries for windows-x64 and linux-x64.

**Result.** On this Windows machine the server initialises and starts in about 7 s. The linux-x64 binaries, with their symlinks restored as the allowed install script does, ran initdb, started and stopped as a non-root user under WSL Ubuntu x86_64. Under CI a failed start fails the run; elsewhere the Postgres runs skip and print why. Test databases are schemas on pooled connections, since opening a worker and a connection costs about 130 ms; property tests run a fifth of their SQLite runs on Postgres.

**Consequence.** ADR 0024 amended; PR 3 reuses `startEmbeddedPostgres` for `make test-e2e`.
