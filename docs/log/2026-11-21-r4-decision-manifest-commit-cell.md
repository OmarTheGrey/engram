---
date: 2026-11-21
author: claude-agent
type: decision
card: R4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_research_scripts.py
  - research/results/MANIFEST.md
  - "uv run pytest -q research/tests/test_research_scripts.py"
supersedes: none
---

**What.** The crosswalk's MANIFEST row names the branch commit that holds the script, 5ab5047, instead of `pending` as the absorb brief asked.

**Why.** `test_each_manifest_file_has_one_row_and_its_commit_is_in_the_history` requires every commit cell to be an ancestor of HEAD, and its docstring says a new row names the branch commit until the orchestrator rewrites it to the squash commit. With `pending` the test failed (`1 failed` in the run of `research/tests/test_research_scripts.py`), so `make test` would fail before the merge.

**Result.** The test passes with the branch commit in the cell.

**Consequence.** The orchestrator rewrites the cell to the squash commit after the merge, as for earlier rows; if it looks for `pending`, this row is the one card R4 added.
