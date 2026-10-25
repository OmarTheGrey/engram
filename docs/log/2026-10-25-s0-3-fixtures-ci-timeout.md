---
date: 2026-10-25
author: claude-agent
type: failure
card: S0.3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/fixtures-ci.test.ts
  - Makefile
supersedes: none
---

**What.** Both cases of scripts/test/fixtures-ci.test.ts timed out at vitest's 5 s default in full parallel `make test` runs, without a code change, and passed when run alone.

**Why.** Each case spawns make, which spawns node to run scripts/check-pr.ts. Alone, one spawn took 1456 to 1663 ms over five runs: about 0.8 s for make and 0.8 s for node. A full suite run competes for the CPU with every other vitest worker.

**Result.** Over three full `pnpm exec vitest run` passes with a JSON report the cases took 9017 and 8802 ms (both failed), then 4990 and 1917 ms, then 3270 and 1688 ms. The same timeout also failed `make test` on branch fix-pr2b on a machine at full CPU load.

**Consequence.** The cases get an explicit timeout; see 2026-10-25-s0-3-fixtures-ci-explicit-timeout.md.
