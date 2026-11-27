---
date: 2026-11-27
author: claude-agent
type: finding
card: R6
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/prereg-v1-plan.md
  - research/configs/openrouter-endpoints.json
  - research/configs/openrouter-endpoints/2026-11-26/openai_gpt-5.4.json
  - packages/runner/src/model/upstream.ts
supersedes: none
---

**What.** The smoke run and B1 now have one more pass criterion, written into their runbook (`docs/tasks/prereg-v1-plan.md`, section 7, "The live checks before the tag"). Every recorded upstream must be the provider the snapshot gives the pin: `Wafer` for M1, `OpenAI` for GPT-5.4 and the judges.

**Why.** Review finding 3: nothing checked that the pinned endpoint served the call.

**Result.** The upstream recorded per call is the stream chunk's `provider`, a provider name. It cannot tell tags apart. `Wafer` covers both `wafer/us` and `wafer/mxfp4`. `OpenAI` covers `openai`, `openai/flex` and `openai/fast`, which the listing gives service tiers `flex` and `priority`. So the criterion catches another provider, not another tag of the same one. Whether `order` with a full tag admits only that tag is OpenRouter's and untested. The registered pass rule (H1's Stopping rule) is unchanged, since card R6 does not sanction editing it.

**Consequence.** If B1's premise, the standard tier, must be proven, a later card records each call's tier or resolved endpoint (backlog row "The resolved model of each call").
