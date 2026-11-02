---
date: 2026-11-03
author: claude-agent
type: measurement
card: R1
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-cost.json
  - research/configs/h1-cost.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h1_cost.py --config research/configs/h1-cost.json --out research/results/h1-cost.json"
supersedes: none
---

**What.** H1's cost on both arms for 14 accepted candidates from six makers, low and high (MANIFEST sha256 `21b06c85...`).

**Why.** v1 names three models; the lead needs their price at H1's sizes (26,616 GateMem sessions; 456 MEM-INV-Bench sessions and 8 notes).

**Result.** GateMem answers take 162M input and 1.3M output tokens (low) to 810M and 2.3M (high); MEM-INV-Bench 0.9M to 2.8M input. The judge (`openrouter/openai/gpt-4o`, 2.5 and 10 dollars per million) costs 67.21 to 268.82 dollars. Totals with the judge, low to high: gpt-6.1-sol 406 to 3,028; gpt-4o 487 to 2,325; gemini-4-argon 406 to 3,028; qwen3.8-max 401 to 2,575; deepseek-v4-pro 177 to 1,030; mistral-large-4-0 181 to 1,058; muse-wonder 745 to 5,786; the small tiers 69 to 649. Both Anthropic models are refused (`anthropic-messages`).

**Consequence.** The table's other columns, GateMem's access and forgetting set alone included, are in the result.
