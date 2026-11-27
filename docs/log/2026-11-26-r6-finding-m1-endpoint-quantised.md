---
date: 2026-11-26
author: claude-agent
type: finding
card: R6
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/configs/openrouter-endpoints.json
supersedes: none
---

**What.** M1's pinned endpoint, Wafer's `wafer/us`, lists quantisation `mxfp4`, a 4-bit format, and the endpoint pin uses tags (`wafer/us`, `openai`) in OpenRouter's `order`.

**Why.** The lead should know before the smoke run what the rule's choice serves, and what was not checked offline.

**Result.** Of M1's thirteen seeded endpoints, the three cheapest at H1's mix are 4-bit (`wafer/us`, `wafer/mxfp4`) or of unknown quantisation (`alibaba`); the fp8 ones start at DeepInfra's `deepinfra/fp8/flex`, about 773 dollars for H1 GateMem. Whether OpenRouter's `order` matches a full endpoint tag, and whether the slug `openai` also admits `openai/flex` and `openai/fast`, was not checked: no call is made. The smoke run prints the upstream that served each call (card RV6), which settles it.

**Consequence.** If the lead wants full precision, `quantizations: ["fp8"]` with a new pin is one config PR before the run.
