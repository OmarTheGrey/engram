---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/analysis/bootstrap.py
  - research/tests/test_analysis.py
  - research/results/h4-power.json
supersedes: none
---

**What.** The TOST switches a side to the exact bound below 10 items differing towards it.

**Why.** The threshold trades level against power: the exact route is valid but needs the share of such items to sit below the margin, so a higher threshold loses power on moderate samples.

**Result.** A seeded scratch probe at thresholds 10, 20 and 30, over margins of 2, 5 and 10 points, rates 0 to 0.10, kappa 0, 0.25 and 1 and both seed models, saw no size above 0.05 at any of them, so the lowest keeps the most power. The committed evidence is the level tests in `test_analysis.py` and the level measured at every size of `h4-power.json`. Cost if wrong: sizes slightly above 0.05 where 10 to 19 items differ.

**Consequence.** None.
