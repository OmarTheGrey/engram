---
date: 2026-11-21
author: claude-orchestrator
type: change
card: R4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/results/h1-crosswalk.json
supersedes: none
---

**What.** The MANIFEST row of `research/results/h1-crosswalk.json` now names its squash commit on main, `a0e7113` (PR #75), instead of the branch commit `86af2a7`.

**Why.** A squash merge rewrites commits, so the branch commit is not in main's history, and `test_each_manifest_file_has_one_row_and_its_commit_is_in_the_history` fails until the cell names a commit on main, as after RV6 (#64) and RV8 (#68).

**Result.** The row's other cells are unchanged; the script and config at `a0e7113` are the ones that produced the bytes.

**Consequence.** Main's research tests pass again.
