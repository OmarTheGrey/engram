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
  - packages/model/src/recording.ts
  - packages/runner/src/research/cost-shapes.ts
supersedes: docs/log/2026-11-21-b10-finding-for-harness-cards.md
---

**What.** What cards B7 and B11 must add around the proxy, restated after review.

**Why.** The proxy is a library in `@engram/model`, which may not import the runner (ADR 0033), so the runner's folders and ledger are the caller's.

**Result.** (1) Pick the folder with `liveConfig` or `replayConfig`; run `recordingRefusal` on it before `fileCache`, which creates its folder; pass `repo` and the journal's `onUsage`. (2) No live upstream exists yet: a ChatCall on pi-ai that sends the seed. (3) LiteLLM strips its provider prefix, so the model the proxy sees must be `provider/model-id`. (4) `callShape` reads message content as strings; a proxy cassette's tool messages may hold null. (5) Two identical misses in flight both reach the ledger as paid in `cached()`. (6) Pass the port to `checkHarnessEndpoint`. (7) Fixtures only from `scriptedChatCall` under ENGRAM_UPDATE_FIXTURES=1.

**Consequence.** B7 and B11 take these in their plans; (5) is the runner's behaviour too.
