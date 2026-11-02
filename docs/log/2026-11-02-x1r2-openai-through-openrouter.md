---
date: 2026-11-02
author: claude-agent
type: finding
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/cassette.ts
  - "grep -o '"id":"openai/gpt-4o","name":"[^"]*","api":"[a-z-]*"' <pi-ai 1.3.0>/dist/providers/data/openrouter.json"
supersedes: docs/log/2026-11-02-x1r-openai-answers-unseeded.md
---

**What.** OpenAI's models can be H1's answer model through pi-ai 1.3.0: its built-in `openrouter` provider serves `openai/gpt-4o`, `openai/gpt-4.1` and the GPT-5 family on the seeded chat-completions API.

**Why.** The earlier finding looked only at pi-ai's `openai` provider, which serves them on the Responses API, and concluded that no OpenAI model could be the answer model (review round 2, R3).

**Result.** pi-ai's OpenRouter catalogue lists 381 models on `openai-completions`, among them `openai/gpt-4o` ("OpenAI: GPT-4o"); the runner's seeded-API rule admits them. The judge now goes this way too.

**Consequence.** PR 4 may pick M1 among OpenAI's models through OpenRouter; the key is an OpenRouter key.
