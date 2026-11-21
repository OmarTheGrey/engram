---
date: 2026-11-21
author: claude-orchestrator
type: change
card: X15
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/results/h2-perf-budget.json
supersedes: none
---

**What.** The MANIFEST row of `research/results/h2-perf-budget.json` now names its squash commit on main, `0cab0dad` (PR #86), instead of the branch commit `cd29ec9`.

**Why.** A squash merge rewrites commits, so the branch commit is not in main's history and `test_each_manifest_file_has_one_row_and_its_commit_is_in_the_history` fails until the cell names a commit on main, as after R4 (#77) and E2.10 (#85).

**Result.** The row's other cells are unchanged; the script and config at `0cab0dad` produce the committed bytes.

**Consequence.** Main's research tests pass again.
