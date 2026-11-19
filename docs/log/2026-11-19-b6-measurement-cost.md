---
date: 2026-11-19
author: claude-agent
type: measurement
card: B6
chapter: results
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-longmemeval-cost.json
  - research/configs/h2-longmemeval-cost.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h2_longmemeval_cost.py --config research/configs/h2-longmemeval-cost.json --out research/results/h2-longmemeval-cost.json"
supersedes: none
---

**What.** The price of LongMemEval's two baselines (C2 and C5 at medium, 3,000 sessions and 3,000 judge calls) on each of H1's candidate models (MANIFEST sha256 `529b1450...`).

**Why.** Card B6 asks for the configs priced with H1's cost machinery, extended to LongMemEval.

**Result.** A read shows 20.0 items under C2 and 19.8 under C5, about 1,892 characters each, against 688 in B5's fixture reads; a session's input is about 10,500 to 10,600 tokens (low) and 61,100 to 61,800 (high). On the recommended M1, `gpt-5.6-terra`, both baselines with the judge cost 65.62 to 643.93 dollars; the judge alone 1.37 to 1.82. The range on the accepted candidates runs from 1.60 (`deepseek-v4.1-flash`, low) to 1,973.22 dollars (`muse-wonder`, high).

**Consequence.** The lead's spend ceiling for H2 can be set from this table.
