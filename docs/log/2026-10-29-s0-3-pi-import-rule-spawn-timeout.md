---
date: 2026-10-29
author: claude-agent
type: change
card: S0.3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/pi-import-rule.test.ts
  - docs/log/2026-10-28-s0-3-pi-import-rule-timeout-corrected.md
  - "pnpm exec vitest run scripts/test/pi-import-rule.test.ts"
supersedes: none
---

**What.** pi-import-rule.test.ts now gives its Biome spawnSync the same 30 s timeout as the test, and a spawn error fails the test.

**Why.** The corrected entry of 2026-10-28 found that nothing bounded the child: spawnSync blocks the worker, so the vitest timeout cannot fire. A timed-out spawn also leaves a null status, which the "rejects every pi import" cases would have read as a lint failure.

**Result.** A new test spawns with a 1 ms timeout and expects ETIMEDOUT; it failed before the change (nothing thrown) and passes after. The four tests pass, and no probe file is left behind.

**Consequence.** The two spawning script tests now agree. With `shell: true` on Windows the timeout kills the shell; a Biome grandchild may outlive it.
