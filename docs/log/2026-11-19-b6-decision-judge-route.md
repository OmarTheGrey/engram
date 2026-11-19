---
date: 2026-11-19
author: claude-agent
type: decision
card: B6
chapter: design
pillar: research
hypothesis: H2
evidence:
  - research/configs/h2-longmemeval-c5-medium.json
  - packages/runner/src/judge.ts
supersedes: none
---

**What.** The baselines' judge is the paper's model, `gpt-4o-2024-08-06`, reached through OpenRouter (`openrouter/openai/gpt-4o-2024-08-06`), at upstream's temperature 0 and 10 tokens.

**Why.** Upstream's judge id is `openai/gpt-4o-2024-08-06`, which pi-ai serves on the OpenAI Responses API; the runner refuses a live call on an API that takes no seed (ADR 0017, finding R7-7), as GateMem's judge does (decision sheet item 19).

**Result.** pi-ai 1.3.0's catalogue resolves the OpenRouter id on `openai-completions`, seeded, at 2.5 and 10 dollars per million input and output tokens (`research/results/h2-longmemeval-cost.json`, `judge`). The live judge reuses `liveJudgeCall`.

**Consequence.** The pre-registration's Models section names GateMem's judge only; the lead may add LongMemEval's in the answers PR.
