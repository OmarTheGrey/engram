---
date: 2026-11-20
author: claude-agent
type: decision
card: RV8
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/configs/cost-table.json
supersedes: none
---

**What.** GLM 5.3 Flash is priced as a reasoning model whose off switch is ignored (`extra_model_flags`).

**Why.** pi-ai 1.3.0's catalogue does not list it, and the price table would otherwise treat an unlisted model as non-reasoning. OpenRouter lists reasoning and reasoning_effort for it.

**Result.** Its high estimate carries 4,096 reasoning tokens a call at 0.0784 dollars per million, a few dollars in all; honoured off would lower it further.

**Consequence.** Pin the flag from a probe when the run's endpoint is chosen; the bound is cheap either way.
