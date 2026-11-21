---
date: 2026-11-20
author: claude-agent
type: change
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/core/src/no-bypass/paths.ts
  - packages/core/test/unit/no-bypass-posix.test.ts
  - packages/core/test/unit/no-bypass.test.ts
  - docs/decisions/0014-no-bypass.md
supersedes: none
---

**What.** The shell no-bypass check now follows `cd`, `pushd`, `-C` and `--directory` within a command. It also judges tree walks (`grep -r`, `find`, `rg`, `tar`, `cp -r`, `rsync` and others) as hits on any folder holding a store root, and reads `~user` (core review finding RV-CORE-5).

**Why.** From cwd `/home/u/proj`, all six of the review's commands reached the root `/home/u/mem` and passed.

**Result.** 27 new blocking cases (22 posix, 5 native) failed on main and pass now. 11 commands that reach no root still pass. The pi extension (232), MCP hook (79) and CLI (188) suites pass unchanged. One R3-13 assertion changed: `rm -rf .claude` against a store root is now a hit, a protected file's folders keep the below-only rule, and a test pins `grep -rn x .` passing for the protected check.

**Consequence.** ADR 0014 has a proposed amendment with the costs and the limits that remain.
