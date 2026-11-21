---
date: 2026-11-21
author: claude-orchestrator
type: failure
card: RV8
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
supersedes: none
---

**What.** Rebasing RV8 onto main left `research/results/MANIFEST.md` with seven duplicate rows. Three carried the results' old names (`label-audit`, `label-audit-longmemeval`, `cost-table`), and four repeated the renamed rows. Their commit cells named commits from before the rebase.

**Why.** Main's RV6 added a row in the same place, so each RV8 commit that touched the table conflicted. Keeping both sides of every conflict kept the old rows as well as the new ones.

**Result.** The old names are dropped, and each RV8 row appears once. Each cell names the latest rebased commit that changed the row's script or config. The ancestry test passes.

**Consequence.** After a squash merge each cell must name the merge commit, as for RV6 (#64).
