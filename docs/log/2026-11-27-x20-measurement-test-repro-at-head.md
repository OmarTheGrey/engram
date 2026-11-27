---
date: 2026-11-27
author: claude-orchestrator
type: measurement
card: X20
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/results/MANIFEST.md
  - "make test-repro"
  - "make test"
supersedes: none
---

**What.** At a553b311 (X20 with main through R6, #120, merged in), on a quiet machine: `make lint` 0, `make lint-docs` 0, `make test` 0 (vitest 6,760 passed, 42 skipped; pytest 564 passed), then `make test-repro` with four workers.

**Why.** X20 changes the code H1 runs, and R6's full run was deferred to this head (`docs/log/2026-11-27-r6-decision-test-repro-at-x20.md`).

**Result.** 23 of 24 rows matched in the run. `h1-redteam.json` stopped because its two pinned payload sets were not in this worktree's `.engram/upstream` under `ENGRAM_OFFLINE=1`; copied from another worktree and checked by the script, it matches (`c1e73f53...10ae`). All 24 rows match their committed sha256.

**Consequence.** X20 and R6 move no MANIFEST row; X20 merges.
