---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_research_scripts.py
  - research/results/MANIFEST.md
supersedes: none
---

**What.** With the new MANIFEST row's commit cell `pending`, as the absorb brief asks, `test_each_manifest_file_has_one_row_and_its_commit_is_in_the_history` fails, since `pending` is no commit.

**Why.** The brief has the orchestrator fill the cell after the squash merge; the test's docstring expects the branch commit until then.

**Result.** `uv run pytest tests/test_research_scripts.py -k manifest`: 1 failed, 3 passed. `reproduce.check_row` for the row itself reports no problem.

**Consequence.** The cell must be filled before `make test` runs on main, or the test must accept `pending`.
