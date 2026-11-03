---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/results/h4-power.json
  - research/results/h4-holm-levels.json
supersedes: none
---

**What.** Recommended, for the lead's decision: H4's margin is 5 percentage points, with 761 items per arm on each benchmark, the score test, and the intersection-union p as its Holm input (decision sheet item 12).

**Why.** Plan decision 2 replaces v0.1's pilot with a power simulation; Holm may test H4 at any 0.05 / k, and only the alpha 0.01 column's sizes are checked at every such threshold, so the size comes from that column.

**Result.** At 5 points, alpha 0.01 and four families, 761 items give 80 percent joint power wherever C5's rate is at most 0.1, except identical seeds at kappa 1 (1,076 at 0.05, 1,810 at 0.1) (`research/results/h4-power.json`); every alpha-0.01 size holds at each Holm threshold, the tightest 761 items at 5 points, 0.009969 against 0.01 (`research/results/h4-holm-levels.json`).

**Consequence.** H4's table code, when written, applies item 13h.
