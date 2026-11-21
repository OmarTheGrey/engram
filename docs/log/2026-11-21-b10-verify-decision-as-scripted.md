---
date: 2026-11-21
author: claude-agent
type: decision
card: B10
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/model/src/scripted.ts
  - packages/model/src/proxy.ts
  - packages/model/test/proxy.test.ts
supersedes: docs/log/2026-11-21-b10-verify-decision-fixture-recording.md
---

**What.** The brand `recordFixtures` checks is applied by an exported helper, `asScripted(call)`, which marks any ChatCall as a scripted upstream with a non-enumerable symbol and returns the same function; `scriptedChatCall` uses it, and `isScripted` reads it (`isScriptedChatCall` stays as an alias). ENGRAM_UPDATE_FIXTURES=1 is still required.

**Why.** Cards B7 (MERIT) and B11 (tau2-bench) record their fixture cassettes from their own scripted agents, not from `scriptedChatCall`, so a brand only `scriptedChatCall` could give would refuse them.

**Result.** A test wraps a harness-style scripted agent in `asScripted`: it records into `fixtures/` under ENGRAM_UPDATE_FIXTURES=1, replays with a hit and no second call, and is refused unwrapped, without the variable, or behind a wrapper of its own. A mutation that brands nothing fails three tests.

**Consequence.** The brand is the caller's promise that the call reaches no model; review of B7 and B11 checks what they wrap.
