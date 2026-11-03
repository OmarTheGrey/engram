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
  - docs/log/2026-11-03-pr4a-finding-seeded-routes.md
supersedes: none
---

**What.** Recommended, for the lead's decision: M1 `openrouter/openai/gpt-5.6-terra`, M2 `openrouter/mistralai/mistral-large-4-0`, M3 `openrouter/deepseek/deepseek-v4-pro-0813` (decision sheet item 1).

**Why.** v1 needs three models from three makers on the seeded chat-completions API, each able to run with reasoning off (`2026-11-03-pr4b-decision-reasoning-off`); OpenRouter lists Anthropic's current models on `anthropic-messages`, which carries no seed (`docs/log/2026-11-03-pr4a-finding-seeded-routes.md`).

**Result.** Weighed: capability, by tier and by the benchmarks' own practice, against cost at H1's size. Among large tiers that can turn reasoning off, OpenAI's gpt-5.6-terra is MEM-INV-Bench's reference model, so its C2 and its notes compare with the recorded study; Google has no such candidate. Costs and the reasoning marks come from part A's fixed `research/results/h1-cost.json` [pending]. `deepseek-v4.1-flash`'s input price looks like a catalogue error and is flagged.

**Consequence.** If changed, v1's Models table and cost sentence change; the configs name the slot `prereg/M1`, not the model.
