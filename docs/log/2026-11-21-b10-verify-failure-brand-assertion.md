---
date: 2026-11-21
author: claude-agent
type: failure
card: B10
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/test/proxy.test.ts
  - packages/model/src/scripted.ts
supersedes: none
---

**What.** The first test of the brand's enumerability passed under a mutation that made the brand enumerable.

**Why.** It asserted `Object.keys(call)` is empty, and `Object.keys` never lists symbol properties, so it could not see the brand at all.

**Result.** The test now reads the call's own symbols and asserts there is one and that it is not enumerable; the mutation then failed it, and the source was restored.

**Consequence.** A test of a symbol property reads `Object.getOwnPropertySymbols`, not `Object.keys`.
