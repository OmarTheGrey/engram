---
date: 2026-10-25
author: claude-agent
type: change
card: S0.3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/fixtures-ci.test.ts
  - docs/log/2026-10-25-s0-3-fixtures-ci-timeout.md
  - make test
supersedes: none
---

**What.** The two fixtures-ci cases now have a 30 s test timeout, and the spawned make has the same 30 s timeout.

**Why.** The cost is the make and node process start, which the test exists to exercise, so it cannot get cheaper without no longer testing `make lint-docs`. 30 s is over three times the worst measured run, 9017 ms. spawnSync blocks the worker, so the child's own timeout is what stops a hung make.

**Result.** No assertion changed. Over three full passes after the change both cases passed every time, taking 1329 to 8209 ms; the 8209 ms run would have failed before. Five consecutive `make test` runs passed.

**Consequence.** pi-import-rule.test.ts already spawns with a 30 s timeout; the two spawning script tests now agree.
