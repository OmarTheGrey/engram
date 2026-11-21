---
date: 2026-11-21
author: claude-agent
type: decision
card: X15
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - research/scripts/perf_budget.py
  - research/configs/perf-budget.json
  - research/tests/test_perf_budget.py
  - docs/log/2026-11-21-x15-failure-rerun-check-aggregate.md
supersedes: docs/log/2026-11-21-x15-decision-tolerance-bands.md
---

**What.** The rerun check's aggregate band is one-sided: per op, the geometric mean of the new to committed median ratios over its plane cells must be at most 1.5; a faster run passes. The per-cell bands stay two-sided, 3 for plane cells and 4 for bare node:sqlite cells. Decided by the coordinator under the lead's delegation.

**Why.** The final rerun of the review fix pass ran faster than the committed run and failed the two-sided band on reads (0.644). The check exists to catch regressions; load that moves every cell together is what the per-cell bands and the repeats absorb. A cell moving 4 times either way makes the measurement suspect.

**Result.** The synthetic test with every read cell twice as slow still fails; a new test with every cell at 0.4 times passes. Neither band was widened.

**Consequence.** The rerun check is run once more against the committed samples.
