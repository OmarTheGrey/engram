---
date: 2026-10-29
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/core/test/db/embedded-postgres.ts
  - scripts/test/vitest-exit-code.test.ts
  - packages/cli/src/doctor.ts
  - packages/cli/test/doctor.test.ts
  - "pnpm exec vitest run scripts/test/vitest-exit-code.test.ts"
supersedes: none
---

**What.** Hotfix: embedded-postgres is imported lazily and the `beforeExit`, `exit` and `message` listeners its exit hook adds are removed; doctor's pins check reads only the registered table of PINS.md.

**Why.** The hook turned failing core and cli runs into exit 0. PR 6 adds a candidates table after the registered one, which doctor would have counted as pins or refused.

**Result.** The fixture project in `fixtures/ci/vitest-exit/` exits 1 on its failing test and 0 on its passing one; keeping the hook's listeners makes the regression test fail. The signal listeners stay, so an interrupted run still stops the server, exiting 128 plus the signal. Doctor with a candidates table still reports the six registered benchmarks.

**Consequence.** `make test` fails on a failing core or cli test again.
