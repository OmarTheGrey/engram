---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/analysis/equivalence.py
  - research/tests/test_equivalence.py
supersedes: none
---

**What.** H4's one primary p-value, the one Holm adjusts with the other four, is the intersection-union p: the largest pairwise TOST p over every pair of every family H4 names (`intersection_union_p`).

**Why.** H4 holds only if every pair is equivalent. Its null is the union of the pairs' nulls; wherever it holds some pair's null holds, and the largest p is below alpha only if that pair's is, with probability at most alpha. So the largest p is valid for H4, and H4 is supported at alpha exactly when every pair is.

**Result.** A test checks the largest p, the decision against every pair at six alphas, and the Holm path with one failing pair. Rejected: Bonferroni over pairs, valid but needlessly conservative. Cost if wrong: none for validity; power is the joint power the table reports.

**Consequence.** PR 4 names this p in the pre-registration's Statistics.
