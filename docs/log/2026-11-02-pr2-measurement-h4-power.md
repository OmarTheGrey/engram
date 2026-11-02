---
date: 2026-11-02
author: claude-agent
type: measurement
card: R1
chapter: results
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-power.json
  - research/configs/h4-power.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h4_power.py --config research/configs/h4-power.json --out research/results/h4-power.json"
supersedes: none
---

**What.** Items per arm for 80 percent power on H4's three-arm equivalence, by seeded simulation with the analysis code's TOST: 72 cells, 400 studies per size, 10,000 resamples per test.

**Why.** Plan decision 2; the evidence for H4's margin and subset in PR 4.

**Result.** At a true violation rate of 0.05, as the test is written: margin 2 points, 269 items (kappa 0.25, independent seeds) to 2,560 (kappa 1, identical seeds); 5 points, 48 to 538; 10 points, 24 to 113. Across rates 0.02 to 0.20 at 2 points: 135 to 10,240. Each size is a rung of a ladder with four steps per doubling; the power at it is 0.80 to 0.95. The grid gives identical bytes run cell by cell or across 32 processes (sha256 `3106ecd8` both ways, on a coarser ladder).

**Consequence.** Read with the finding entry of the same day.
