---
date: 2026-11-19
author: claude-agent
type: failure
card: RV2
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - "git merge-base --is-ancestor b59a1f7 main (likewise 1897c40, 1cee40b): exit 1, not on main"
supersedes: none
---

**What.** Four MANIFEST rows named commits that are not on main (RV-EXP-9): h3-fault-set `b59a1f7`, h3-lint-floor `1897c40`, and both h2 rows `1cee40b`.

**Why.** Each cell was written on its PR's branch, and the squash merge replaced those commits. No one rewrote the cells afterwards, as decision sheet item 17 requires.

**Result.** Confirmed with `git merge-base --is-ancestor`: none of the three commits is an ancestor of main `07828fc`.

**Consequence.** The cells are rewritten to squash commits on main (`docs/log/2026-11-19-rv2-manifest-commits.md`).
