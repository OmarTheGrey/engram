---
date: 2026-11-21
author: claude-agent
type: decision
card: B10
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/model/src/proxy.ts
  - packages/model/test/proxy.test.ts
supersedes: none
---

**What.** `chatRequest` maps an OpenAI body to the keyed request: a leading text system message to `system`; text user and assistant messages, `temperature`, `max_tokens` and a strict `json_schema` format to their ModelRequest fields; every other message and parameter verbatim (`params`); nulls, `stream: false` and `n: 1` dropped as OpenAI's defaults.

**Why.** A call the runner could make must have the runner's key, and nothing that changes an answer may stay out of the hash. Hashing an unknown parameter can only cause a loud miss, never a silent false hit.

**Result.** The same-key test asserts the mapped body equals the runner's ModelRequest. A `top_p` of 0.9, another temperature or another model each miss in the replay test.

**Consequence.** A harness that sends a per-run value (such as a random `user`) misses on replay and must stop sending it.
