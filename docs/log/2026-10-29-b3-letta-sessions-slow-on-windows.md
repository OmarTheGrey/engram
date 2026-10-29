---
date: 2026-10-29
author: claude-agent
type: finding
card: B3
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/b3.test.ts
  - packages/runner/test/live.test.ts
  - "pnpm --filter runner exec vitest run test/b3.test.ts"
supersedes: none
---

**What.** With the Letta store in the B3 config, the B3 acceptance test (the config run twice offline) takes about 207 s on this Windows machine, against its earlier 120 s bound.

**Why.** Every ingested GateMem turn is one Letta commit: 474 writes per run, each three git processes (a `cat-file` check, an intent-to-add, the commit) at tens of milliseconds each on Windows.

**Result.** The test's bound is now 600 s and the cross-store denial test's 180 s (that test takes about 18 s on Letta). The live-replay test (R5-5, `live.test.ts`) now replays the config on fake and Mem0 only, since it tests the replay, not the store.

**Consequence.** `make test` on Windows is longer by about three minutes; on Linux git processes cost a few milliseconds, so CI stays within the layer 7 budget. Fewer git calls per write would be an adapter change of its own.
