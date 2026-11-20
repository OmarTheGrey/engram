---
date: 2026-11-20
author: claude-agent
type: change
card: X4
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/analysis/effects.py
  - "cd research && uv run pytest tests/test_effects.py"
supersedes: none
---

**What.** The H1 table's schema goes from `h1-table/2` to `h1-table/3`: every contrast (C4 minus C5, C3 minus C5, C2 minus C5, in every set) carries an `effect` block from `analysis.effects.relative_reduction`.

**Why.** Card X4's effect sizes belong beside the test they describe, and the figure reads them from the table.

**Result.** Before: a contrast held the mean difference, BCa and percentile intervals and the p-value. After: the same, plus `effect` with `rate_first`, `rate_second`, `difference`, `relative_reduction`, `low`, `high`, `undefined_resamples` and `registered: false`. The effect draws from its own seed, so every existing p-value and interval is unchanged. Nine tests in `research/tests/test_effects.py`; two mutants (unpaired rates, ratio not subtracted from one) each fail them. The change to `research/analysis/h1.py` is 13 lines.

**Consequence.** No committed result holds an H1 table, so nothing is regenerated.
