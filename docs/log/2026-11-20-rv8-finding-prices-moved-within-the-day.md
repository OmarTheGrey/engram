---
date: 2026-11-20
author: claude-agent
type: finding
card: RV8
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - research/configs/openrouter-prices.json
supersedes: docs/log/2026-11-20-rv8-finding-deepseek-price.md
---

**What.** OpenRouter's list moved during 2026-11-20: deepseek-v4-pro-0813 went from 0.22 in and 9.5 out to 1.32 and 3.96, deepseek-v4.1-flash from 0.051 and 0.567 to 0.3 and 1.2, and the model count from 479 to 477.

**Why.** The orchestrator's finding of the same day saw the new DeepSeek price against the file; the price file was right for its fetch, the list had changed.

**Result.** A second fetch (sha256 f494e908...a3d0, 926,144 bytes), repeated once with identical bytes, replaced every price; only those two models differ. z-ai/glm-5.3-flash is listed at 0.0399 in, 0.0784 out.

**Consequence.** Prices are list prices of a moment; recheck on the day each run starts. The file keeps both fetches' hashes.
