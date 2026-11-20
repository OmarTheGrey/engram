---
date: 2026-11-20
author: claude-agent
type: decision
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_research_scripts.py
supersedes: none
---

**What.** A MANIFEST commit cell must name a commit HEAD contains; the test makes no exception for the PR's own rows, and skips the ancestry half only in a checkout without git.

**Why.** An exception keyed on the PR's commits would need the test to know which branch it runs on. Before the merge, a new row names the branch commit holding its script, which HEAD contains; a squash merge replaces that commit, and the orchestrator rewrites the cell to the squash commit right after the merge, as it does for every new row.

**Result.** The `h1-check-runs-cost` row names `1834c82`, an ancestor of the branch head. On main, between the squash and the orchestrator's rewrite, the test fails on that one row.

**Consequence.** The orchestrator's post-merge rewrite is what keeps main green; a missed rewrite is caught by `make test`.
