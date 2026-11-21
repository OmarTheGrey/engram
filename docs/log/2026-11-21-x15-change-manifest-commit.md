---
date: 2026-11-21
author: claude-agent
type: change
card: X15
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/tests/test_research_scripts.py
supersedes: docs/log/2026-11-21-x15-failure-manifest-pending-commit.md
---

**What.** The MANIFEST row of `research/results/h2-perf-budget.json` names the branch commit that holds the config and script producing its bytes, instead of `pending`.

**Why.** `test_each_manifest_file_has_one_row_and_its_commit_is_in_the_history` failed on `pending`; card R4 named its branch commit, which the orchestrator rewrites to the squash commit after the merge.

**Result.** `uv run pytest -q research/tests/test_research_scripts.py` passes with the row.

**Consequence.** After the squash merge the orchestrator rewrites the cell to the squash commit.
