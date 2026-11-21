---
date: 2026-11-20
author: claude-agent
type: change
card: RV8
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/scripts/cost_table.py
  - research/configs/cost-table.json
  - research/configs/openrouter-prices.json
  - research/tests/test_cost_table.py
supersedes: none
---

**What.** One cost table covers every registered run, H1 to H5, per benchmark, condition, preset, store, model role and judge: sessions, calls, prompt and completion tokens, dollars per candidate model, and the RV1 ceiling.

**Why.** RV-DES-20: only H1 and H2's LongMemEval baselines were priced, and the lead decides the spend from the whole.

**Result.** 128 rows, 93 of them estimated from the design and marked so. Built runs take their sessions from what COUNT=1 counted (h1-cost, h2-longmemeval-cost, h3-lint-floor, and L3's pilot counted by run.ts) and their token shapes from those results; the H1 rows give back h1-cost's own totals to 1e-6 (test). Totals are given for every option of items 1, 2 and 47, at two price sets.

**Consequence.** The lead can set each run's ceiling from its row.
