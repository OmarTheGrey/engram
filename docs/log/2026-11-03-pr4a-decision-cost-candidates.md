---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-cost.json
supersedes: none
---

**What.** The cost table prices, per maker, the newest general model of a large and a small tier on OpenRouter's chat completions in pi-ai 1.3.0's catalogue: OpenAI, Google, DeepSeek, Qwen, Mistral and Meta, two each; OpenAI's `gpt-5.6-terra` (MEM-INV-Bench's recorded study) and `gpt-4o` (GateMem's judge) as references; Anthropic's two current models, which the runner refuses.

**Why.** The plan asks three makers at least, two tiers where the catalogue has them, and only models the answer path accepts; the references let the lead compare with the benchmarks' own runs.

**Result.** Excluded by rule: `:batch`, `:free`, `-pro`, preview, code, image and audio variants, and `~` aliases, which float. xAI is left out: its chat-completions models on OpenRouter show one tier.

**Consequence.** If the lead wants another model, one config line adds it; the shapes do not change.
