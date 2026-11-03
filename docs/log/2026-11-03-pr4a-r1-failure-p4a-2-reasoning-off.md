---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-cost.json
  - packages/runner/src/research/cost-shapes.ts
  - packages/runner/src/conditions.ts
supersedes: none
---

**What.** The cost table's low estimate counted no reasoning tokens for any model, because the runner asks for thinking off; for six candidates that request never reaches the model.

**Why.** pi-ai 1.3.0 (`api/openai-completions.js`, OpenRouter's format) sends an off effort only when the catalogue's `thinkingLevelMap.off` is not null; for `openai/gpt-6.1-sol`, `google/gemini-4-argon`, `google/gemini-3.8-flash`, `qwen/qwen3.8-max-0902`, `meta/muse-wonder` and `meta/muse-glimmer-30b` it is null, so no reasoning parameter is sent and the provider's default effort applies. The table read the catalogue's `reasoning` flag and not what pi-ai sends. Found by the review (P4A-2).

**Result.** `catalogueEntry` now records `off_effort` and `can_turn_reasoning_off`, the result marks each candidate, and the low estimate prices a stated floor for the six (`pr4a-r1-decision-cost-range`).

**Consequence.** Read the transport, not only the catalogue's flags.
