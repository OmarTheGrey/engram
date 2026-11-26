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
  - research/results/h1-cost.json
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** M1 (`openrouter/deepseek/deepseek-v4-pro-0813`) is pinned to Wafer's `wafer/us`, not to DeepSeek's own endpoint.

**Why.** DeepSeek's endpoint (tag `deepseek`) does not list `seed` among its supported parameters, and AGENTS.md rule 6 seeds every sampled call. Review finding R6-3 raised it, and the lead answered on 2026-11-26, "Seed first" (`docs/tasks/lead-decisions.md`, "The lead's answers, 2026-11-26"): the maker's endpoint is used only if it honours `seed`, otherwise the cheapest that does. The Models sentence now says so.

**Result.** Thirteen endpoints honour `seed`. Priced at H1 GateMem's high token estimate (738,446,779 input, 2,324,463 output; `research/results/h1-cost.json`, `tokens.gatemem.high`), `wafer/us` costs about 92 dollars, `wafer/mxfp4` 220, Alibaba's `alibaba` 433. The snapshot's `price_weights` records the weights.

**Consequence.** Cheaper real spend than the ledger meters. See the finding on its 4-bit quantisation.
