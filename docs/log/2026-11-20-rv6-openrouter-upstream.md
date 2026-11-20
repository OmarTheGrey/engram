---
date: 2026-11-20
author: claude-agent
type: change
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/upstream.ts
  - packages/runner/src/live.ts
  - packages/model/src/cached.ts
  - packages/runner/test/rv6-upstream.test.ts
supersedes: none
---

**What.** A runner config's `openrouter_provider` pins OpenRouter's upstream for the answer model and for the judge, and every live OpenRouter call records the upstream that served it in its cassette (`response.upstream`) and in the usage ledger (`upstream`) (RV-DES-11).

**Why.** OpenRouter serves one model from several upstreams, which can answer differently; H1 recorded neither.

**Result.** `routedModels` sets the routing as the model's `compat.openRouterRouting`, and reads the upstream from each stream chunk's `provider` field. Against a fetch that answers in OpenRouter's stream format, pi-ai's own OpenRouter provider sent `"provider": {"order": ["deepinfra"], "allow_fallbacks": false}` with the seed, and the judge's cassette and both ledger records (the call and its replay) named the upstream. A live run refuses a pin for a model not on OpenRouter, or one model pinned two ways. `make run` prints `served by:` per model.

**Consequence.** The lead names the upstreams before the tag (backlog row).
