---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - research/analysis/power.py
  - research/tests/test_equivalence.py
supersedes: none
---

**What.** A scratch local search over seven-point nulls reported levels up to 0.0149 at 381 items, 5 points, alpha 0.01, well above the three-point supremum of 0.0121.

**Why.** Its candidates added mass to a distribution summing to 1 and were renormalised after the mean was set, so their mean sat about 2.5 percent of the margin inside it: not nulls. Put back on the margin, the same distribution's exact level is 0.0115, and Monte Carlo agrees.

**Result.** Every candidate the committed search and its tests evaluate goes through `on_margin`, which normalises before it sets the mean; the tests assert the reported distribution's mean is minus the margin.

**Consequence.** None.
