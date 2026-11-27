---
date: 2026-11-25
author: claude-agent
type: failure
card: L8
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/scripts/cost_table.py
supersedes: none
---

**What.** In the first byte comparison, under the default reach, research/scripts/cost_table.py stopped before computing anything.

**Why.** The fresh worktree had no pinned GateMem data, and ENGRAM_OFFLINE=1 forbids the fetch. It failed with "episodes.jsonl is missing and ENGRAM_OFFLINE=1 forbids the fetch".

**Result.** The pinned data was copied from another worktree (the script checks its hashes). With the registered reach passed, the rerun printed `SAME research/results/h2-cost-table.json`. Its lint counts come from planModelLints, whose units are the same under both reaches.

**Consequence.** h2-cost-table was compared once, under the registered reach. The four H3 rows were compared under both reaches.
