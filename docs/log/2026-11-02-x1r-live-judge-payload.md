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
supersedes: none
---

**What.** The live judge sends upstream's structured-output payload (`text.format`, json_schema, strict) through pi-ai's `samplingParams` on the OpenAI Responses API, at temperature 0 and with no seed; a structured attempt on any other API is refused.

**Why.** pi-ai has no structured-output option, but its Responses adapter merges `samplingParams` into the request body as it is, and pi-ai serves `openai/gpt-4o` on that API. Upstream sends no seed and the Responses API takes none; the row's seed only keys the cache.

**Result.** A test on a recording model collection checks the exact options sent for attempts 1 and 3; dropping `samplingParams` fails it.

**Consequence.** A judge other than an OpenAI Responses model needs its own payload, a later change.
