---
date: 2026-11-21
author: claude-agent
type: change
card: E8.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/kit/src/index.ts
  - packages/kit/test/kit.test.ts
  - "make test-one T=packages/kit/test/kit.test.ts"
supersedes: none
---

**What.** `packages/kit` (`@engram/kit`): `createKit`, `scopeOf` and `namespaceOf`, `EngramRejected` and `EngramCallError`.

**Why.** Card E8.14 step 2: what every framework adapter repeats, so each adapter stays a page.

**Result.** The actor is deep-copied, frozen and given source `model` at construction, and no method takes an actor, source, owner or provenance. `remember`, `recall`, `get` and `scopes` are each one request of the generated client. `scopeOf` maps `[level, id]`, `["org"]` or a scope string and refuses anything else, deeper namespaces included. A denied write throws `EngramRejected` carrying the deny event. Recall renders the pi extension's memory tag. 9 tests pass. The kit has no policy branch.

**Consequence.** LangGraph and Mastra adapters can be built on it, each its own card.
