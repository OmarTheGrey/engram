---
date: 2026-11-03
author: claude-agent
type: finding
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-cost.json
  - packages/runner/src/model/cassette.ts
  - packages/runner/test/research/cost-shapes.test.ts
supersedes: none
---

**What.** Through pi-ai 1.3.0, OpenRouter is the one route that reaches OpenAI's, Google's, DeepSeek's, Qwen's, Mistral's and Meta's models on the seeded chat-completions API, and no route reaches Anthropic's current models on it.

**Why.** The runner accepts only `openai-completions` (`SEEDED_APIS`); the cost table needed candidates the answer path accepts.

**Result.** pi-ai's own providers serve OpenAI, xAI and Meta on Responses APIs, Google on `google-generative-ai` and Mistral on `mistral-conversations`, all refused; DeepSeek's own provider is on chat completions. OpenRouter lists `anthropic/claude-sonnet-5.5` and `claude-haiku-5.5` on `anthropic-messages` (refused in `research/results/h1-cost.json`); its chat-completions Anthropic entries are `:batch` variants and floating `~anthropic/*-latest` aliases, neither fit for a pinned run.

**Consequence.** v1's three models come from three of the six makers above; one OpenRouter key serves them and the judge.
