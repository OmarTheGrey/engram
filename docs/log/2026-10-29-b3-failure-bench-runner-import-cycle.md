---
date: 2026-10-29
author: claude-agent
type: failure
card: B3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/gatemem-probe.ts
  - "pnpm --filter runner exec vitest run test/live.test.ts"
supersedes: none
---

**What.** Moving `turnTime` into `@engram/bench` and re-exporting it from the runner as `export const turnTime = gatemem.turnTime` made every runner test file fail to load.

**Why.** `@engram/bench` and `@engram/runner` import each other (bench's judge uses the runner's model code). Loading the runner first loads bench, which loads the runner's index while `gatemem` is still unbound, so the top-level alias read a property of undefined.

**Result.** The re-export is now a function that calls `gatemem.turnTime` when called, after both modules have loaded; the runner suite passes (88 tests).

**Consequence.** A runner module may use `gatemem.*` only inside functions, never at module top level, while the cycle exists.
