---
date: 2026-11-20
author: claude-agent
type: failure
card: RV8
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/configs/openrouter-prices.json
supersedes: none
---

**What.** The web-fetch tool's summary of https://openrouter.ai/api/v1/models said none of the candidate models were listed and no prices were present.

**Why.** Its small summarising model read a truncated page.

**Result.** A direct fetch of the same JSON (927,325 bytes, 479 models) listed every candidate with its prices; the config records that response's sha256.

**Consequence.** Prices are taken from the raw JSON, never from a summary.
