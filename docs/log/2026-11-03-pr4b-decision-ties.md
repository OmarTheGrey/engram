---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/log/2026-11-02-pr2-decision-comparison-tolerance.md
  - docs/log/2026-11-02-pr2-decision-z0-ties.md
supersedes: none
---

**What.** Recommended, for the lead's decision: every comparison of a resample mean with a bound treats values within 1e-9 as equal, and BCa's z0 counts ties with the observed mean as half below (decision sheet item 13c).

**Why.** On 0/1 outcomes the bootstrap distribution is a lattice, and floating-point sums put exact ties a few units in the last place off.

**Result.** Both choices are PR 2's (the two entries cited); `research/tests/test_analysis.py` matches scipy's endpoints to 1e-12 on a continuous sample, where the two z0 rules agree.

**Consequence.** If changed, `TOLERANCE` and `bca_interval` in `research/analysis/bootstrap.py`.
