---
date: 2026-11-06
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/src/index.ts
  - packages/bench/test/load.test.ts
  - packages/runner/test/load.test.ts
  - "pnpm exec vitest run packages/bench/test/load.test.ts packages/runner/test/load.test.ts packages/model"
supersedes: none
---

**What.** The cached model call and the scripted models moved from `packages/runner/src/model/` into a new workspace package, `@engram/model`, which `@engram/bench` and `@engram/runner` both import (backlog item, step 1 of the lead's delegation list).

**Why.** Bench imported the runner's cache and the runner imports bench, so a top-level use of one in the other read an unset binding at load (`docs/log/2026-10-29-b3-failure-bench-runner-import-cycle.md`).

**Result.** Bench no longer depends on the runner; each package loads alone in a fresh process with the other's exports bound at top level. The runner re-exports the moved names, so its importers are unchanged. The full suite (`VITEST_MAX_WORKERS=4`) has 2,485 passed, with only failures already on main (`2026-11-06-step1-failure-baseline-on-windows.md`); `make bench BENCH=gatemem` and the offline B3 replay make zero new calls.

**Consequence.** The B3 rule that a runner module may use `gatemem.*` only inside functions no longer applies. Card B5's harness uses the cache from `@engram/model`.
