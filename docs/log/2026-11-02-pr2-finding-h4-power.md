---
date: 2026-11-02
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-power.json
  - research/analysis/power.py
  - docs/research/preregistration.md
supersedes: none
---

**What.** About 100 items per arm, the pre-registration's subset, powers H4 in 17 of 24 grid cells at a 10-point margin, 7 of 24 at 5 points, and none at its proposed 2 points.

**Why.** The size scales with the variance of the item-level difference over the margin squared: kappa times 2p(1 - p), divided by three when seeds are independent samples.

**Result.** From `research/results/h4-power.json`: halving kappa halves the size, identical seeds triple it, and requiring all three pairs costs 1.2 to 1.7 times the one-pair approximation (ladder rounding included). At wide margins with strong pairing the test passes studies whose pairs show no discordant item: 10 items as written, 269 if those fail.

**Consequence.** For PR 4's sheet, not decided here: a 5 or 10 point margin with the subset, or 2 points with hundreds of items per store; kappa stays unmeasured without a pilot.
