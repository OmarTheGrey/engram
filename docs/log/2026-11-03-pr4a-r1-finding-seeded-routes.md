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
supersedes: docs/log/2026-11-03-pr4a-finding-seeded-routes.md
---

**What.** Through pi-ai 1.3.0, OpenRouter is the one route that reaches OpenAI's, Google's, DeepSeek's, Qwen's, Mistral's and Meta's models on the seeded chat-completions API; Anthropic's current models are on it only as `:batch` entries and floating aliases.

**Why.** The runner accepts only `openai-completions` (`SEEDED_APIS`); the superseded entry said the same, and the review asked what those Anthropic entries are (P4A-5).

**Result.** pi-ai's own providers serve OpenAI, xAI and Meta on Responses APIs, Google and Mistral on their own APIs, all refused; DeepSeek's own is on chat completions. OpenRouter lists `anthropic/claude-sonnet-5.5` and `claude-haiku-5.5` on `anthropic-messages` (refused). Its chat-completions entries `anthropic/claude-*-5.5:batch`, named "(batch)" at half price, cannot be shown to serve synchronous, seeded calls without one; `~anthropic/claude-*-latest` float. `research/results/h1-cost.json` prices all four as non-candidates.

**Consequence.** v1's three models come from the six makers above; one OpenRouter key serves them and the judge.
