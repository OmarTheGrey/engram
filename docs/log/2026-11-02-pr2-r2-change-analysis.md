---
date: 2026-11-02
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/analysis/equivalence.py
  - research/analysis/bootstrap.py
  - research/tests/test_equivalence.py
  - "uv run pytest research/tests/test_analysis.py research/tests/test_equivalence.py"
supersedes: docs/log/2026-11-02-pr2-review-change-analysis.md
---

**What.** The analysis code after the second review round: H4's TOST moved to `analysis/equivalence.py` as a score test; the bootstrap module keeps H1's paired bootstrap.

**Why.** Review findings V1, V3 and V6.

**Result.** `tost(differences, margin, alpha)` returns z and p per side and the TOST's p-value, needs no seed, and decides from (sum d, sum d^2) through `equivalent_from_sums`, which the power simulation uses too. `test_equivalence.py` (28 tests) covers the decision, the p-value's scale through Holm and `decide_h1`, monotonicity by property tests, the zero-discordance size, exact levels at kappa 0 over a grid and their agreement with simulation, and simulated levels on the margin. `test_analysis.py` keeps the H1 table and bootstrap tests.

**Consequence.** None.
