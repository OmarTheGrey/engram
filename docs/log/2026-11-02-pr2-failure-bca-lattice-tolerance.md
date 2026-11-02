---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_analysis.py
  - "uv run pytest research/tests/test_analysis.py -k scipy"
supersedes: none
---

**What.** The first test comparing the paired bootstrap's BCa interval with scipy's, within Monte Carlo error, failed on a sample of thirds.

**Why.** The sample's 30 items take values in thirds, so resample means sit on a lattice with step 1/90 (0.011); the upper endpoints were 0.378 against scipy's 0.389, one step apart, while the tolerance was 3 percent of the width (0.009). On that sample BCa and the percentile interval also differed by at most one step, so the test could not have told them apart.

**Result.** The Monte Carlo comparison moved to a right-skewed sample on which BCa moves the upper endpoint by about a fifth of the width and four seeds stay within 3.3 percent of scipy at 200,000 resamples; the tolerance is 5 percent and the test also requires BCa and percentile to differ by more than 10 percent.

**Consequence.** None for the code.
