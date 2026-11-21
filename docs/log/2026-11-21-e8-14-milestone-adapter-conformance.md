---
date: 2026-11-21
author: claude-agent
type: milestone
card: E8.14
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/kit/test/conformance/suite.ts
  - packages/kit/test/conformance.test.ts
  - packages/ai-sdk/test/conformance.test.ts
  - "make test-one T=packages/ai-sdk/test/conformance.test.ts"
  - "make test-one T=packages/kit/test/conformance.test.ts"
supersedes: none
---

**What.** The conformance suite for adapters on the kit, `@engram/kit/conformance`, passes on the reference adapter and on `@engram/ai-sdk`.

**Why.** Card E8.14 step 4 and its acceptance.

**Result.** Four cases: a static check (no store dependency, and no import of a store, the file system, SQLite, a child process, or core at run time); every store call inside a plane request, with the store holding only allowed items; a denied write as `EngramRejected` with the log's deny event; and the actor unchanged by forged model input or by changing the construction object. Reference adapter 4 of 4, ai-sdk 4 of 4. The meta test runs five broken adapters and each fails its named case (10 tests in the kit's file).

**Consequence.** Every later framework adapter registers its subject the same way.
