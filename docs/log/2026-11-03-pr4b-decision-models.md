---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/results/h1-cost.json
  - docs/log/2026-11-03-pr4a-r1-finding-seeded-routes.md
supersedes: none
---

**What.** Recommended, for the lead's decision: M1 `openrouter/openai/gpt-5.6-terra`, M2 `openrouter/mistralai/mistral-large-4-0`, M3 `openrouter/deepseek/deepseek-v4-pro-0813` (decision sheet item 1).

**Why.** v1 needs three models from three makers on the seeded chat-completions API, each able to run with reasoning off (`2026-11-03-pr4b-decision-reasoning-off`); Anthropic's current models are on `anthropic-messages`, which carries no seed, and its `:batch` and alias entries are not candidates (`docs/log/2026-11-03-pr4a-r1-finding-seeded-routes.md`).

**Result.** Weighed: capability, by tier and the benchmarks' own practice, against cost at H1's size. Among large tiers that can turn reasoning off, gpt-5.6-terra is MEM-INV-Bench's reference model, so its C2 and notes compare with the recorded study; Google has none. With the judge, gpt-5.6-terra costs 389.58 to 3,105.53 dollars, Mistral large 173.42 to 1,004.94, DeepSeek v4 pro 170.20 to 977.66 (`research/results/h1-cost.json`). `deepseek-v4.1-flash`'s input price, 1.07 times its cache-read price, stays flagged.

**Consequence.** If changed, v1's Models table and cost sentence change; the configs name the slot `prereg/M1`, not the model.
