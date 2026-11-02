---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - research/analysis/bootstrap.py
  - research/tests/test_analysis.py
  - "git show 9e70d70"
supersedes: none
---

**What.** A mutation that made z0 count ties as below survived the test suite, and the cause was that floating-point rounding hid the ties altogether.

**Why.** On a 30-item sample of thirds, scipy's exact comparison found 189 of the 611 resamples whose mean equals the observed mean in exact arithmetic; this module's multinomial sums found none of 637. The same rounding decided whether a resample at zero counted as "at or below zero", the pre-registered p-value.

**Result.** Comparisons now use a 1e-9 tolerance (decision entry of the same day). New tests check the p-value and the TOST shares against exact integer sums, and z0 on ties split by rounding; the z0, strict-p and no-tolerance mutants are now killed. The first H4 power run, on the old code, was stopped and discarded.

**Consequence.** Any later statistic comparing resample means with a bound must use `at_or_below` and `at_or_above`.
