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
supersedes: docs/log/2026-11-02-pr2-review-change-h4-power.md
---

**What.** The H4 power simulation after the second review round.

**Why.** Review findings V1 to V3, and a first run that was too slow to finish.

**Result.** `power.py` simulates a study as one multinomial draw of its items' joint states (`item_states`), computes the TOST's level exactly at kappa 0 (`exact_level`) and by simulation elsewhere (`simulated_level`), and gates sizes with `level_gate`. The script walks with 1,000 studies, confirms with 4,000, checks levels with 20,000 runs under both seed models at kappas 0.02, 0.05, 0.1 and the cell's own, at alpha 0.05 and 0.01, in about ten seconds for 48 cells. Tests: item-state probabilities, agreement with simulating every item, the gate's two halves at the script's call site.

**Consequence.** PR 4 reads the new table.
