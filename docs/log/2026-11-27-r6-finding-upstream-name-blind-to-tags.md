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

**Result.** The recorded upstream is a provider name, which cannot tell tags apart. `Wafer` covers both `wafer/us` and `wafer/mxfp4`. `OpenAI` covers `openai`, `openai/flex` and `openai/fast`. So it catches another provider, not another tag. Whether `order` with a full tag admits only that tag is untested. The registered pass rule in H1's Stopping rule is unchanged, since R6 does not sanction editing it.

**Consequence.** Proving B1's standard tier needs a later card that records each call's tier (backlog row "The resolved model of each call").
