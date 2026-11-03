---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/log/2026-11-03-pr4a-decision-cost-candidates.md
  - research/configs/h1-cost.json
supersedes: none
---

**What.** The candidate decision entry said `-pro` variants were excluded while the config's DeepSeek large pick is `deepseek-v4-pro-0813`.

**Why.** The entry summarised the exclusions as a list of suffixes, but the picks were made by tier, and "pro" means a premium variant at OpenAI and the large tier at DeepSeek. Found by the review (P4A-7).

**Result.** Superseded by `pr4a-r1-decision-cost-candidates`, which states the rule the picks follow.

**Consequence.** A selection rule is written from the picks it produced, then checked against them.
