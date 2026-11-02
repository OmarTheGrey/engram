---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/judge.ts
  - packages/runner/test/judge.test.ts
  - research/configs/h1-gatemem.json
supersedes: docs/log/2026-11-02-x1r-live-judge-payload.md
---

**What.** The live judge is GPT-4o through OpenRouter's seeded chat completions (`openrouter/openai/gpt-4o`, temperature 0, 4096 tokens), with the row's seed and upstream's JSON schema as `response_format`; a judge on an API that takes no seed is refused before it is called.

**Why.** The first fix pass sent unseeded calls on OpenAI's Responses API, which ADR 0017 (finding R7-7) says must be refused (review round 2, R4). Routing through a seeded API keeps the rule without an exception.

**Result.** Tests check the exact options for the structured and plain attempts, the refusal on the Responses API, and that action gating stays off as upstream's `gate_by_action` defaults to false; dropping the seed or turning gating on fails them.

**Consequence.** PR 4's decision sheet: the judge needs an OpenRouter key; upstream reached GPT-4o through OpenAI directly.
