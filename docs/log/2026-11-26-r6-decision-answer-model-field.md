---
date: 2026-11-26
author: claude-agent
type: decision
card: R6
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/model/upstream.ts
  - packages/runner/src/live.ts
  - packages/runner/test/rv6-endpoints.test.ts
supersedes: none
---

**What.** The model a pin was chosen for is `openrouter_provider.answer_model`, a field of `OpenRouterProvider` beside `answer` and `judge`, never inside the routing object.

**Why.** The routing object is OpenRouter's own `provider` body, sent as is by pi-ai, so a field there would reach OpenRouter (the coordinator's decision on review finding R6-2). The judge needs none: its model is fixed in the config.

**Result.** `liveConfig` refuses a `MODEL=` other than `answer_model`, and `upstreamRoutes` refuses it again for a caller that skips `liveConfig`. The schema refuses `answer_model` without `answer`. Absent, any model runs as before. The field is in the pin's hash, so in the cassette folder's name and the run's fingerprint.

**Consequence.** Running an experiment config on M2 or M3 needs its own pinned config.
