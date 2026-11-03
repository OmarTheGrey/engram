---
date: 2026-11-03
author: claude-agent
type: finding
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-cost.json
supersedes: none
---

**What.** pi-ai 1.3.0's catalogue lists `deepseek/deepseek-v4.1-flash` on OpenRouter at 0.00576 dollars per million input tokens: 1.07 times its cache-read price (0.0054) and 125 times below its output price (0.72).

**Why.** Every other candidate's input sits at 2 to 30 times its cache-read price and 3 to 6 times below its output price, so this one is likely the cache-read price entered as the input price.

**Result.** Its low total, 67.90 dollars with the judge, is almost all judge; its answers cost 1.83 dollars low on GateMem. `research/results/h1-cost.json` flags it (`price_anomaly`) and uses the listed price. The catalogue cannot be checked against OpenRouter offline.

**Consequence.** For part B: do not choose this model on its price before checking OpenRouter's listing; at a typical small-model input price its cost would be near the other small tiers'.
