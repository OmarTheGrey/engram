---
date: 2026-11-20
author: claude-orchestrator
type: change
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/results/MANIFEST.md
supersedes: none
---

**What.** The MANIFEST row of `research/results/h1-check-runs-cost.json` now names 1347327, the squash commit of PR #60 on main. Before, it named d47b13a, a commit on the PR branch.

**Why.** A squash merge rewrites a branch's commits, so a cell naming a branch commit is not an ancestor of main. RV6's own test, `test_each_manifest_file_has_one_row_and_its_commit_is_in_the_history`, fails until the cell names a commit on main.

**Result.** The cell names a commit on main, and the row's sha256 is unchanged.

**Consequence.** Every PR that adds a MANIFEST row needs this follow-up after its squash merge.
