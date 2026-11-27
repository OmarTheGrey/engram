---
date: 2026-11-27
author: claude-agent
type: finding
card: R6
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/configs/openrouter-endpoints.json
  - research/configs/openrouter-endpoints/2026-11-26/deepseek_deepseek-v4-pro-0813.json
supersedes: none
---

**What.** OpenRouter's keyless endpoint list for the four models was read once more on 2026-11-27 and compared with the committed 2026-11-26 responses. The new responses were not committed.

**Why.** Review finding 2 asks that every pinned endpoint list every parameter sent. A day-old snapshot could be stale.

**Result.** No endpoint was added or removed, and no endpoint's `supported_parameters` or quantisation changed. The pinned endpoints are unchanged. Four M1 prices moved: Alibaba's two endpoints doubled, Baidu's rose about fivefold, and Relace's input fell. None of them is pinned, and `wafer/us` is still the cheapest seeded endpoint.

**Two points remain unchecked offline.** pi-ai sends `max_completion_tokens` where OpenRouter lists `max_tokens`, and it also sends `store` and `stream_options`. Whether `require_parameters` counts these could not be checked offline. If it refuses them, the first call fails and the run stops, which is the safe direction.

**Consequence.** The smoke run is the first live test of these points.
