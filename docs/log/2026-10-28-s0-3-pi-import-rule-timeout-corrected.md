---
date: 2026-10-28
author: claude-agent
type: change
card: S0.3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/pi-import-rule.test.ts
  - scripts/test/fixtures-ci.test.ts
supersedes: docs/log/2026-10-25-s0-3-fixtures-ci-explicit-timeout.md
---

**What.** Corrects the consequence of the S0.3 explicit-timeout entry: pi-import-rule.test.ts does not spawn with a 30 s timeout.

**Why.** The round 2 verification of PR #2 (finding N4) read the file: its `SPAWN_TIMEOUT` of 30 s is passed to vitest as the test timeout only, and its `spawnSync` of Biome has no `timeout` option.

**Result.** Only fixtures-ci.test.ts bounds both the test and the spawned process at 30 s. In pi-import-rule.test.ts nothing bounds the child: spawnSync blocks the worker, so the vitest timeout cannot fire while Biome runs, and a hung Biome run would hang the worker. The rest of the superseded entry stands.

**Consequence.** The two spawning script tests do not yet agree; giving pi-import-rule.test.ts's spawnSync the same timeout is left to the S0.3 owner.
