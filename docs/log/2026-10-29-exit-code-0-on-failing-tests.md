---
date: 2026-10-29
author: claude-agent
type: failure
card: E1.1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/core/test/db/embedded-postgres.ts
  - scripts/test/vitest-exit-code.test.ts
  - fixtures/ci/vitest-exit/vitest.config.ts
supersedes: none
---

**What.** From PR 2 (E1.1, merged as #10 on 2026-10-29) until this hotfix, a failing test in the core or cli vitest projects could exit 0, so `make test` and CI could not fail on them.

**Why.** Both projects load core's embedded-postgres global setup. Importing embedded-postgres registers async-exit-hook, whose `beforeExit` listener calls `process.exit(0)` on the next tick and overwrote vitest's exit code 1. The bench and adapters projects do not load it and exited 1.

**Result.** Reported by the orchestrating session on 2026-10-29; reproduced here with a temporary failing test in packages/core (exit 0, also with `ENGRAM_PG=skip`, since the import alone registers the hook). With the fix, `make test` on main (65893c9) passes 1720 tests: no test had been failing silently.

**Consequence.** A regression test now asserts the exit code of a failing run, not only its output.
