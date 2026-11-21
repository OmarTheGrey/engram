---
date: 2026-11-21
author: claude-agent
type: failure
card: X15
chapter: implementation
pillar: plane
hypothesis: H2
evidence:
  - research/tests/test_research_scripts.py
  - research/results/MANIFEST.md
supersedes: none
---

**What.** With the MANIFEST row's commit cell set to `pending`, as the absorb plan's brief asks, `test_each_manifest_file_has_one_row_and_its_commit_is_in_the_history` fails: `git merge-base --is-ancestor pending HEAD` finds no commit.

**Why.** The test expects the cell to name the branch commit before the squash merge; the brief asks for `pending` and leaves the commit to the orchestrator after the merge.

**Result.** `uv run pytest -q research/tests/test_prereg.py research/tests/test_research_scripts.py research/tests/test_perf_budget.py`: 1 failed, 61 passed. Every other research test touched passes.

**Consequence.** The orchestrator fills the cell with the squash commit (or the branch commit before `make test`); then the test passes. Nothing else depends on the cell.
