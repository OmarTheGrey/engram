---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/scripts/h4_power.py
  - research/analysis/power.py
supersedes: none
---

**What.** A size enters the H4 table only if, with one pair's true difference on the margin, either way, equivalence is declared in at most 0.05 plus two Monte Carlo standard errors of 1,000 runs (0.0638), under the cell's kappa and under kappa 0.

**Why.** The review asks that no recommended size fail the level. Kappa 0 is the sparsest disagreement a margin allows (one arm violates wherever the other does, and on a margin's share more), where a bootstrap is weakest.

**Result.** When a rung fails the gate the walk moves up a rung. Cost if wrong: two standard errors admit a true size up to about 0.064 by chance at a given rung.

**Consequence.** Each size in `h4-power.json` carries both measured levels.
