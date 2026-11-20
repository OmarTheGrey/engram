---
date: 2026-11-20
author: claude-agent
type: measurement
card: RV8
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/results/cost-table.json
  - "uv run python research/scripts/cost_table.py --config research/configs/cost-table.json --out research/results/cost-table.json"
supersedes: none
---

**What.** The full cost table, MANIFEST row research/results/cost-table.json.

**Why.** RV-DES-20; lead-decisions items 1, 2, 3 and 47.

**Result.** At OpenRouter's list of 2026-11-20, every registered run: 448,403 to 877,385 calls. Option (a): 2,101 to 21,865 dollars, ceiling 27,331 (H1 390 to 3,106; H2 941 to 5,094; H3 103 to 1,999; H4 436 to 9,284; H5 231 to 2,382). (b) DeepSeek as M1: 868 to 11,053; (b) Mistral as M1: 1,123 to 9,355; (c) gpt-6-luna: 450 to 3,365; (c) mistral-small: 491 to 3,727. Item 47b saves 837 dollars on (a) at the high estimate.

**Consequence.** H4's MemoryAgentBench arms (design estimate, 1,024-token chunks) are the largest uncertain term; see the finding on item 2.
