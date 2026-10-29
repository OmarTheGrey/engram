---
date: 2026-10-29
author: claude-agent
type: change
card: E0.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/doctor.ts
  - packages/cli/src/setup.ts
  - packages/cli/test/doctor.test.ts
  - packages/cli/test/setup.test.ts
  - test/e2e/cli.e2e.test.ts
  - docker-compose.yml
  - .env.example
  - "make test-e2e"
supersedes: none
---

**What.** Card E0.4, phase 1: one `openDb(target)` for `--db`, `ENGRAM_DB_URL` or the per-user default; a complete `engram doctor`; `make test-e2e` on SQLite; `.env.example` and a deployment-only `docker-compose.yml`.

**Why.** Doctor skipped provider keys, pins and Mem0, and layer 6 was a stub. The lead ruled out Docker in tests, gates and CI.

**Result.** Doctor runs ten checks: log and backend, policy, store, files and Mem0 adapters through a Plane on an in-memory log, letta skipped (A2), provider keys by name only, PINS.md with the GateMem fixture's 24 line hashes, the pi pin, Node 24. Each has a red test (`packages/cli/test/doctor.test.ts`, 22 tests); `make test-e2e` passes 5 steps in about 8 s. A Postgres target fails with "Postgres backend not available yet (card E1.1)".

**Consequence.** Phase 2 wires Postgres targets to `openPostgres` and adds embedded Postgres to the e2e run.
