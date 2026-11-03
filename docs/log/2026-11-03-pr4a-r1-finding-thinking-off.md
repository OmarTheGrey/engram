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
  - packages/runner/test/research/cost-shapes.test.ts
supersedes: none
---

**What.** On six candidates H1 cannot run with thinking off: `openai/gpt-6.1-sol`, `google/gemini-4-argon`, `google/gemini-3.8-flash`, `qwen/qwen3.8-max-0902`, `meta/muse-wonder` and `meta/muse-glimmer-30b`.

**Why.** The runner asks every session for thinking off; pi-ai 1.3.0 forwards that to OpenRouter only for models whose catalogue maps off to an effort.

**Result.** For these six the catalogue maps off to null, so pi-ai sends no reasoning parameter and each provider's default effort applies, unseen by the cassette key. Neither pi-ai nor its catalogue states that default or its token count. `gpt-6-luna`, `gpt-5.6-terra`, both DeepSeek, both Mistral models and `qwen3.8-flash` receive effort "none"; `gpt-4o` has no reasoning (`research/results/h1-cost.json`, `can_turn_reasoning_off`).

**Consequence.** For part B's model choice: on these six, H1 measures the model at its provider's default reasoning, an uncontrolled difference from the others, and its cost is the least certain.
