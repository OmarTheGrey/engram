---
date: 2026-11-20
author: claude-agent
type: finding
card: RV8
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/configs/openrouter-prices.json
  - research/results/h1-cost.json
supersedes: none
---

**What.** OpenRouter's list on 2026-11-20 prices DeepSeek v4 pro at 0.22 dollars in and 9.5 out per million, where pi-ai 1.3.0's catalogue (2026-10-15) gives 0.66 and 1.98.

**Why.** Item 1's ranges come from the catalogue; the cost table prices from a fetched list.

**Result.** With DeepSeek as M1, H1 costs 112 to 1,503 dollars at OpenRouter's prices against 170 to 978 at the catalogue's (`totals`, `1b-deepseek`). Its output price makes the high estimate, with 1,024 reasoning tokens per call, 54 percent higher. gpt-5.6-terra and Mistral large 4 moved under 3 percent. The fetched list's sha256 is in the prices config.

**Consequence.** Item 1's quoted range for (b) is low at today's prices; recheck prices on the day of the run.
