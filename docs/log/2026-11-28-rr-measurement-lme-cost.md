---
date: 2026-11-28
author: claude-agent
type: measurement
card: none
chapter: results
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-longmemeval-cost.json
  - research/configs/h2-longmemeval-cost.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h2_longmemeval_cost.py --config research/configs/h2-longmemeval-cost.json --out research/results/h2-longmemeval-cost.json"
supersedes: docs/log/2026-11-19-b6-measurement-cost.md
---

**What.** A cost estimate of LongMemEval's two baselines (C2 and C5 at medium, 1,500 sessions each, `sizes.c2.sessions`), restated against the registered M1.

**Why.** The superseded entry called `gpt-5.6-terra` the recommended M1; the pre-registration's Models section now names `openrouter/deepseek/deepseek-v4-pro-0813`.

**Result.** At pi-ai 1.3.0 catalogue prices, both baselines with the judge on M1 cost 22.430372 to 188.917692 dollars (`candidates[6].total_with_judge`); on `gpt-5.6-terra`, 65.621982 to 643.926063 (`candidates[2]`). The judge costs 0.682618 to 0.910157 per baseline (`judge.cost.judge_c2`). A read holds 20.0 items under C2 and 19.8 under C5 (`measured.*.full_set.items_per_read`). Across candidates the range is 1.598619 (`candidates[7]`, low) to 1,973.215813 (`candidates[12]`, high). No model was called.

**Consequence.** These are catalogue dollars, not list prices; the cost table's decided block carries M1's list-price figures.
