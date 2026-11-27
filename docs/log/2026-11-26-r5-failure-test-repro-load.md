---
date: 2026-11-26
author: claude-agent
type: failure
card: R5
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - "make test-repro"
  - research/results/MANIFEST.md
supersedes: none
---

**What.** `make test-repro` could not finish on the shared machine: first no `node_modules` in the fresh worktree (19 of 24 rows failed), then memory exhaustion and a 50-minute limit.

**Why.** Under several agents' load, scipy and numpy could not load or allocate ("The paging file is too small", `_ArrayMemoryError` on 6 to 21 MiB); `frontier_axes.py` hit a MemoryError, then a 40-minute limit.

**Result.** 22 of 24 rows match, the two label-audit rows at their new hashes; rows were rerun one at a time with `ENGRAM_RESEARCH_WORKERS=2`, red-team after copying its pinned data from another worktree. Not finished: `h4-holm-levels.json` (memory, twice) and `h2-frontier-axes.json` (memory, then timeout). Neither reads the audit configs.

**Consequence.** The orchestrator's serial run before merge must confirm those two rows.
