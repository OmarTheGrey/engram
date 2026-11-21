---
date: 2026-11-21
author: claude-agent
type: finding
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/src/proxy.ts
  - packages/model/src/cached.ts
  - packages/runner/src/live.ts
  - packages/runner/src/research/cost-shapes.ts
supersedes: none
---

**What.** What cards B7 and B11 must add around the proxy, found while building it.

**Why.** The proxy is a library in `@engram/model`, which may not import the runner (ADR 0033), so the runner's guards and ledger are the caller's.

**Result.** (1) No cassette folder or ledger is chosen: compose `liveConfig` or `replayConfig` with a `fileCache`, and pass the journal's `onUsage`. (2) No live upstream exists yet: a ChatCall on pi-ai that sends the seed. (3) LiteLLM strips its provider prefix from the model, so the model the proxy sees must be set to `provider/model-id`. (4) `callShape` reads cassette message content as strings; a proxy cassette's tool messages may hold null. (5) Two identical misses in flight at once both reach the ledger as paid calls in `cached()`.

**Consequence.** B7 and B11 take these in their plans; (5) is the runner's behaviour too.
