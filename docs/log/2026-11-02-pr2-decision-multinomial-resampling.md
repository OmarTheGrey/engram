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

**What.** A bootstrap resample is drawn as multinomial counts of the distinct item-level differences, not as n drawn indices.

**Why.** The mean of a resample depends only on how often each item is drawn, so pooling items with equal differences gives the same distribution; it costs time in the number of distinct values (at most seven for three seeds) instead of the number of items, which makes 10,000 resamples per test affordable inside the power simulation.

**Result.** `resample_means`; a test checks the bootstrap moments (mean d, variance s2 over n within 3 percent), and the means agree with scipy's index resampling within Monte Carlo error on a skewed sample. Cost if wrong: none statistically; the random stream differs from scipy's, so the same seed does not give scipy's draws.

**Consequence.** None.
