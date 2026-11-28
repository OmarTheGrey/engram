---
date: 2026-11-28
author: claude-agent
type: failure
card: E1.7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/core/test/model/trace-replay.test.ts
supersedes: none
---

**What.** The first run of the closed-finding tests failed: `e18RetractionWhileErasingTest` ends with a handle inside an offboarding, which the test required idle.

**Why.** The scenario stops while the erasure is open, in the model as in the code.

**Result.** The test asserts the replay matches to the end instead (`r.mismatch` null); 225 of 225 then pass.

**Consequence.** Nothing.
