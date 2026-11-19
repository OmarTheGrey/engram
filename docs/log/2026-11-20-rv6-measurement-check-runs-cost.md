---
date: 2026-11-20
author: claude-agent
type: measurement
card: RV6
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/results/check-runs-cost.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/check_runs_cost.py --config research/configs/check-runs-cost.json --out research/results/check-runs-cost.json"
supersedes: none
---

**What.** The price of the two pre-tag checks, from H1's cost code and shapes: `research/results/check-runs-cost.json` (MANIFEST row `check-runs-cost.json`).

**Why.** The checks are paid calls before the tag; the lead sees their price first.

**Result.** List prices from pi-ai 1.3.0's catalogue, low to high: smoke GateMem 0.44 to 3.01 USD (answers on gpt-5.6-terra 0.37 to 2.71, the GPT-4o judge 0.07 to 0.30), smoke MEM-INV-Bench 0.08 to 1.25, B1 on GPT-5.4 2.06 to 6.04 (answers 1.68 to 4.55, judge 0.37 to 1.49); in all 2.59 to 10.30. A C1 session averages 4,242 input tokens on the B1 subset (636,382 over 150 calls, low). C2 to C5 sessions are priced at H1's full-set means, C1 at each item's own prompt.

**Consequence.** The configs' ceilings (5, 3 and 10 USD per provider) sit above the high estimates.
