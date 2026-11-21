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
  - packages/model/src/scripted.ts
  - packages/model/test/proxy.test.ts
supersedes: none
---

**What.** `recordFixtures: true` is accepted only with ENGRAM_UPDATE_FIXTURES=1 in the proxy's environment and an upstream made by `scriptedChatCall`, which brands it with a non-enumerable symbol checked by `isScriptedChatCall`; any other combination is a ProxyRefused.

**Why.** Verification V-1: `recordFixtures` accepted any upstream, so a harness card could write live, paid cassettes into `fixtures/`, and `make test` would replay them as goldens. ENGRAM_UPDATE_FIXTURES=1 is the variable `make fixtures` already sets for pi-extension.

**Result.** Tests: a plain async upstream is refused (with a memory cache and with a fixtures file cache), a scripted upstream without the variable or with it set to 0 is refused, and a scripted upstream with it records into `fixtures/`. The brand is one symbol, not enumerable, so a wrapper or a spread copy of the call does not carry it.

**Consequence.** `make fixtures` must set ENGRAM_UPDATE_FIXTURES=1 for any harness card's fixture recording.
