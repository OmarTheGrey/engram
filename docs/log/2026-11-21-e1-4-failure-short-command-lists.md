---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - "make test-one T=packages/core/test/property/stateful.test.ts"
supersedes: none
---

**What.** The first passing runs of the stateful property failed their own guards: no erasure, no granted read, no eviction, no promotion.

**Why.** fc.commands with only `maxCommands: 24` keeps its default size, so a run averaged about five commands (166 over 30 runs), and every command after a crash is skipped until a reopen comes up.

**Result.** With `size: "max"`, 200 runs and up to 40 commands, the default run meets every guard (in a run of 200: 21 erasures, 4 granted reads, 1 eviction, 1 promotion, 31 refusals in a frozen scope, 193 crashes), in about 3 s. Reopen is offered twice in the command list so crashed runs recover sooner.

**Consequence.** The guards stay: a change that makes the model meet less fails the test, not silently.
