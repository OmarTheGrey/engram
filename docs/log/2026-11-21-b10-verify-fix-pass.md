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
  - packages/model/src/scripted.ts
  - packages/model/test/proxy.test.ts
  - packages/runner/test/reserved-harnesses.test.ts
  - packages/model/src/cached.ts
  - docs/tasks/B10.md
supersedes: none
---

**What.** Card B10's verification fix pass answers V-1 to V-5, on the branch rebased onto main at E2.8 (`1c458f0`).

**Why.** The verification confirmed the eight review fixes and found one important latent gap and four minor ones.

**Result.** V-1: `recordFixtures` needs ENGRAM_UPDATE_FIXTURES=1 and an upstream branded by `scriptedChatCall` (`isScriptedChatCall`). V-2: a runner test builds the seven runner context functions and checks each item prefix is in `RESERVED_HARNESSES`, and the list holds nothing else. V-3: an endpoint naming no port is port 80. V-4: the card's Files list names the review's additions. V-5: `fileCache`'s comment says it creates its folder. The proxy file passes 27 tests and the runner test 1; five mutations, one per change, each failed a test.

**Consequence.** B7 and B11 record fixtures only from `scriptedChatCall` under `make fixtures`.
