---
date: 2026-11-27
author: claude-agent
type: change
card: R6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-gatemem.json
  - research/configs/openrouter-endpoints.json
  - packages/runner/test/rv6-endpoints.test.ts
  - docs/research/preregistration.md
  - "make test-one T=packages/runner/test/rv6-endpoints.test.ts"
supersedes: none
---

**What.** Every pin in the nine live configs now sets `require_parameters: true`. The snapshot lists each call's parameters (`sent_parameters`, from pi-ai 1.3.0's `buildParams` and the cassettes' request shapes). The test requires the field on every pin, and requires each pinned endpoint to list every parameter its calls send. The Models sentence names the field.

**Why.** Review finding 2: with `allow_fallbacks: false` alone, an endpoint that dropped `seed` would still be routed to and answer unseeded, unrecorded (rule 6).

**Result.** Every parameter sent is listed: `wafer/us` takes seed, tools, reasoning, temperature, max_tokens, response_format and structured_outputs; GPT-5.4 on `openai` takes seed, tools and reasoning (no temperature, which its answer turns never send); both judges take theirs. 20 of 20 pass. Mutation: an answer turn that also sends temperature fails B1's pin; restored.

**Consequence.** A dropped parameter now stops the run at its first call (card X20) instead of passing silently.
