---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-power.json
  - research/analysis/power.py
  - research/scripts/h4_power.py
  - research/tests/test_equivalence.py
  - research/tests/test_research_scripts.py
supersedes: docs/log/2026-11-02-pr2-r2-decision-level-gate.md
---

**What.** A size enters H4's table only if the largest level found over the composite null at that size, and the exact levels of the cell's own pair (both seed models; kappas 0.02, 0.05, 0.1 and its own), are at most alpha. No level is simulated.

**Why.** Review findings R2-1 and R2-2: the identical-seed supremum over the whole boundary, and mixed-difference nulls.

**Result.** Each level is exact: (sum d, sum d^2) by FFT of the characteristic function on a window Bernstein's inequality bounds, the mass outside added (`lattice_level`). The supremum is a search: three-point supports on grids, then SLSQP climbs over all seven probabilities; twelve random-start climbs at each of eight sizes (a scratch check; the tests climb from three at two sizes) found nothing above it. Cost if wrong: a missed maximum admits a size above alpha.

**Consequence.** Each size records the supremum's distribution and which check set it.
