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
supersedes: docs/log/2026-11-03-pr4a-measurement-cost.md
---

**What.** H1's cost after the review fixes, 14 candidates and 4 priced non-candidates (MANIFEST sha256 `f147daf7...`).

**Why.** Review findings P4A-2, P4A-5, P4A-6 and P4A-8 changed what is priced.

**Result.** GateMem answers: 152.9M input and 1.3M output tokens (low) to 738.4M and 2.3M (high); judge 66.06 to 264.25 dollars. Totals with the judge, low to high: gpt-6.1-sol 526 to 6,206 and gemini-4-argon the same (both ignore thinking off); qwen3.8-max 465 to 4,422; muse-wonder 985 to 12,148; gpt-5.6-terra 390 to 3,106; gpt-4o 464 to 2,141; deepseek-v4-pro 170 to 978; mistral-large-4-0 173 to 1,005; small tiers 68 to 2,492, gemini-3.8-flash the highest. `deepseek-v4.1-flash` is flagged as a likely price anomaly.

**Consequence.** Read with `pr4a-r1-finding-cost-drivers` and `pr4a-r1-finding-thinking-off`.
