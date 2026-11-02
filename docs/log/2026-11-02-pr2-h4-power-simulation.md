---
date: 2026-11-02
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/analysis/power.py
  - research/scripts/h4_power.py
  - research/configs/h4-power.json
  - research/tests/test_research_scripts.py
supersedes: none
---

**What.** H4's sample size is computed by seeded simulation with the analysis code's own TOST (`research/analysis/power.py`, `research/scripts/h4_power.py`).

**Why.** Plan decision 2: v0.1 sized H4 from a pilot, which needs a model key.

**Result.** Each simulated study draws three arms (stores or models) with the same true violation rate, runs `tost` on every pair, and passes only if all three pairs pass. The grid crosses margins 0.02, 0.05 and 0.10 with rates 0.02 to 0.20, discordance kappa 1, 0.5 and 0.25, and independent or identical seeds; 400 studies per sample size, 10,000 resamples per test. A ladder of sizes (four steps per doubling) is walked from the normal approximation's estimate to the smallest size reaching 80 percent power. Tests check the simulated rate and discordance, the approximation's formula, and the ladder walk.

**Consequence.** PR 4 reads the table to recommend H4's margin and subset.
