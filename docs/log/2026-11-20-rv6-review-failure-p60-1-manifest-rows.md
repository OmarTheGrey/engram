---
date: 2026-11-20
author: claude-orchestrator
type: failure
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/results/MANIFEST.md
  - research/tests/test_research_scripts.py
supersedes: none
---

**What.** Four rows of `research/results/MANIFEST.md` (h3-fault-set `b59a1f7`, h3-lint-floor `1897c40`, h2-longmemeval-ttl and h2-longmemeval-cost `1cee40b`) stood twice, once with the commit cells RV2 had rewritten to main's commits and once with the old ones (review P60-1).

**Why.** The orchestrator's rebase of `rv6` onto main resolved a conflict in the MANIFEST by keeping both sides; no test refused a second row for a file. The new `h1-check-runs-cost` row also named `88e6c78`, a commit the rebase had rewritten away.

**Result.** The four stale rows are deleted, and the new row names `1834c82`, the rebased commit that holds its script. `test_each_manifest_file_has_one_row_and_its_commit_is_in_the_history` refuses a file listed twice and a commit cell that `git merge-base --is-ancestor` does not find in HEAD; it failed on the duplicates before the fix, and on `88e6c78` put back.

**Consequence.** A rebase that resurrects a row, or a commit cell that names a rewritten commit, now fails `make test`.
