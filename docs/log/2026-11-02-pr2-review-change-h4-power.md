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
supersedes: docs/log/2026-11-02-pr2-h4-power-simulation.md
---

**What.** The H4 power simulation was reworked in the review pass: the new TOST, per-family targets, confirmation of the chosen rung, a level check at every reported size.

**Why.** Review findings P2-1, P2-6 and P2-7.

**Result.** `power.py` draws arms from shared or own uniform draws (`simulate_arms`), measures the level with one pair on the margin (`size_at_margin`), gives the joint normal approximation (`joint_threshold`) and chooses a rung with `choose_rung`. The script walks with 400 studies, confirms with 1,000, checks the level with 1,000 runs per direction under the cell's kappa and kappa 0, for one, two and four families; 48 cells take about six minutes on 32 processes. Tests: rates and discordance of simulated arms, a pair on the margin, the closed forms, the rung choice, the grid's process independence, a reported size's level on an independent rerun.

**Consequence.** PR 4 reads the new table.
