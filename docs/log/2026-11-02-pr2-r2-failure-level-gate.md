---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - docs/log/2026-11-02-pr2-review-decision-level-gate.md
  - research/analysis/power.py
supersedes: none
---

**What.** Review finding V2: the round-one level gate admitted true levels above 0.05 and was decided by Monte Carlo noise.

**Why.** It accepted a measured level up to 0.05 plus two standard errors, so a true level of 0.0548 (381 items, 5 points, computed exactly) passed in one cell and failed in another; and independent-seed cells were checked only under independent seeds, though seeds may repeat their outcome.

**Result.** The gate now requires the exact level at kappa 0, under both seed models, to be at most alpha, and the measured level at kappas 0.02, 0.05, 0.1 and the cell's own, under both seed models, to be at most alpha by two standard errors (decision entry of the same day). A test stubs power and simulation so the exact level alone decides.

**Consequence.** The round-one `h4-power.json` is withdrawn.
