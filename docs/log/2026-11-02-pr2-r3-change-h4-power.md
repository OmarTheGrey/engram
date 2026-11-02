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
  - research/tests/test_equivalence.py
  - docs/deps.md
supersedes: docs/log/2026-11-02-pr2-r2-change-h4-power.md
---

**What.** The H4 power table after the third review round: every level exact.

**Why.** Review findings R2-1, R2-2 and R2-8.

**Result.** `power.py` adds `lattice_sums`, `lattice_level`, `lattice_level_gradient`, `on_margin`, `difference_distribution` and `composite_sup`; `level_gate` goes, and the config loses `simulations_level`. The script shares suprema between workers and records per size the supremum and its distribution, the cell's own levels, the failing checks and `set_by`. scipy moves from a dev to a research dependency for SLSQP (`docs/deps.md`). The table takes 12 minutes on 32 cores.

**Consequence.** PR 4 reads the new table.
