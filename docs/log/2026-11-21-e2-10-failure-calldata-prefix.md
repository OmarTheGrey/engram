---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/injection-screen.ts
  - packages/core/test/unit/policy/injection-screen.test.ts
supersedes: none
---

**What.** The new test that a long hex run weighs 2 under default failed: Ethereum calldata scored 7, because its `0x` prefix made the run read as non-hex base64 too.

**Why.** The test was written from the review's probe before checking how base64-run treats a prefix.

**Result.** A `0x`-prefixed run now counts as hex, which hex-run alone judges; the test passes.

**Consequence.** None.
