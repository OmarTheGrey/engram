---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.19
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - "make test-invariants"
supersedes: none
---

**What.** One run of `make test-invariants` printed 4 files and 23 tests passed and still exited 1 (ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL); the next run exited 0.

**Why.** Not found. The chain file starts an embedded Postgres; under the shared machine's load its teardown is the likely cause.

**Result.** Rerun alone: exit 0, 23 passed.

**Consequence.** Load, as the brief says; reported, not chased.
