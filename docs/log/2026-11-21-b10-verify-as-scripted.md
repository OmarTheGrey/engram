---
date: 2026-11-21
author: claude-agent
type: change
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/src/scripted.ts
  - packages/model/src/proxy.ts
  - packages/model/test/proxy.test.ts
  - packages/model/src/index.ts
supersedes: none
---

**What.** `@engram/model` exports `asScripted`, `isScripted` and, as before, `isScriptedChatCall`; the proxy's `recordFixtures` check and its refusal message name `asScripted`.

**Why.** The coordinator's constraint on fix V-1: the brand must be applicable to any scripted upstream.

**Result.** Before: only `scriptedChatCall` could brand a call. After: any ChatCall wrapped in `asScripted`. The acceptance file passes 28 tests.

**Consequence.** B7 and B11 wrap their scripted agents in `asScripted` to record fixtures.
