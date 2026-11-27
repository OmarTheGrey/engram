---
date: 2026-11-26
author: claude-agent
type: decision
card: R6
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/configs/openrouter-endpoints.json
  - packages/runner/test/rv6-endpoints.test.ts
supersedes: none
---

**What.** "Cheapest" in the Models rule means the lowest cost of a fixed token mix at the endpoint's input and output prices, the mix being H1 GateMem's high estimate, recorded as `price_weights` in the snapshot.

**Why.** The registered rule does not say how to compare an endpoint cheap on input with one cheap on output. M1's runs are about 300 input tokens to one output token, so the sum of the two prices (which would pick Alibaba) misprices them by a factor of about 4.7.

**Result.** The test's rule (`ruleTag`) applies the weights and refuses a tie.

**Consequence.** If wrong, M1 would sit on Alibaba's `alibaba` endpoint at about 433 dollars for H1 GateMem instead of 92; the pin is one config change.
