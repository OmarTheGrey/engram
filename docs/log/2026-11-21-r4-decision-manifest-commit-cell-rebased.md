---
date: 2026-11-21
author: claude-agent
type: decision
card: R4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/tests/test_research_scripts.py
supersedes: docs/log/2026-11-21-r4-decision-manifest-commit-cell.md
---

**What.** After the rebase onto main, the crosswalk's MANIFEST commit cell names beb820d, the commit holding the script and config that produce the committed bytes.

**Why.** The rebase rewrote the earlier cell's commit (5ab5047), which is no longer an ancestor of HEAD, and `test_each_manifest_file_has_one_row_and_its_commit_is_in_the_history` requires one.

**Result.** `git merge-base --is-ancestor beb820d HEAD` holds and `scripts.reproduce.check_row` on the row returned no problems.

**Consequence.** The coordinator rewrites the cell to the squash commit after the merge.
