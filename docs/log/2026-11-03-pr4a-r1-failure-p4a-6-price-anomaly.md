---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-cost.json
  - research/scripts/h1_cost.py
supersedes: none
---

**What.** The cost table priced `deepseek/deepseek-v4.1-flash` at an input price of 0.00576 dollars per million tokens without remarking that it looks wrong.

**Why.** The script copied catalogue prices unchecked. Found by the review (P4A-6).

**Result.** `price_anomaly` now flags a candidate whose input price is under 1.5 times its cache-read price or whose output price is over 25 times its input price; only this model is flagged (finding `pr4a-r1-finding-price-anomaly`). The price is still used as listed.

**Consequence.** A flagged price is checked against the provider's own page before a model is chosen on it.
