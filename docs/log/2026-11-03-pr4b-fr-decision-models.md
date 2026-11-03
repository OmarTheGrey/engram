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
supersedes: docs/log/2026-11-03-pr4b-decision-models.md
---

**What.** Recommended, for the lead's decision: M1 `openrouter/openai/gpt-5.6-terra`, MEM-INV-Bench's reference model, M2 Mistral large and M3 DeepSeek v4 pro (decision sheet item 1), restated.

**Why.** In the final verification of PR #27 (V-9) the sheet called gpt-5.6-terra "the large tier", which the cost table does not, claimed its C2 comparable with the recorded study, and named only two Anthropic models.

**Result.** Its notes compare with the fixture's recorded ones; its C2 does not compare with the study, since the runner shows memory through `memory_read` (top 20, any-term match) where upstream shows the whole memory (ADR 0029), and the study's reasoning setting is unchecked. Every Anthropic model in the catalogue, Opus 5.5 and Fable 5.1 included, is on `anthropic-messages`. Costs unchanged (`research/results/h1-cost.json`).

**Consequence.** Item 1 now weighs reasoning off against instruction following.
