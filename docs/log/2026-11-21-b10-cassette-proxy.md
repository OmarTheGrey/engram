---
date: 2026-11-21
author: claude-agent
type: change
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/src/proxy.ts
  - packages/model/test/proxy.test.ts
  - "make test-one T=packages/model/test/proxy.test.ts"
supersedes: none
---

**What.** Card B10 adds the cassette proxy of ADR 0036 to `@engram/model`: `startProxy` serves `POST /v1/chat/completions` on 127.0.0.1 through `cached()`, keyed by `cacheKey`, the function the runner's calls are keyed by.

**Why.** MERIT (H2) and tau2-bench (H5) call their models through LiteLLM, outside rules 6 and 7; the proxy brings those calls under the same cache without porting either harness.

**Result.** Replay is the default and a miss is a 404 `cassette_miss` returned and kept in `errors`; `new_episodes` records from an injected upstream and is refused under ENGRAM_OFFLINE=1; usage goes to `onUsage` as the runner's UsageRecord; streaming and embeddings return 501. The acceptance command passes 17 tests, among them a first run of 3 new calls, then a second run and a replay of 0 new calls with byte-identical bodies.

**Consequence.** Cards B7 and B11 wire MERIT and tau2-bench to it.
