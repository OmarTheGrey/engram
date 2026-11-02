---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/analysis/bootstrap.py
  - research/tests/test_analysis.py
supersedes: none
---

**What.** Every comparison of a resample mean with a bound (at or below zero, beyond a margin, tying the observed mean) treats values within 1e-9 as equal.

**Why.** "The share of resamples at or below zero" must count the resamples whose mean is zero in exact arithmetic, and floating-point sums put many of them a few units in the last place above zero (see the failure entry of the same day).

**Result.** `TOLERANCE = 1e-9`: far above the rounding error (units in the last place of numbers near one, about 1e-16 each), and more than 60,000 times below the smallest step between distinct means at 5,000 items and three seeds (1 / 15,000). Tests compare the p-value and the TOST shares with exact integer sums. Cost if wrong: none for seed-averaged 0/1 outcomes; a continuous metric with gaps under 1e-9 would merge them.

**Consequence.** None beyond the code.
