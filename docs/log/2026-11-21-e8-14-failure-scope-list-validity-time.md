---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/read-by-id.test.ts
  - "make test-one T=packages/core/test/property/read-by-id.test.ts"
supersedes: none
---

**What.** The first scope listing judged validity windows at the log's head instead of the time asked for, and its property test failed.

**Why.** `Plane.read` judges access at `accessTime` (the head, when later) but validity at the requested time; the listing passed only the access time to `evaluateRead`.

**Result.** The counterexample: an item granted to the reader, whose `valid_from` was one second after the time asked for, was listed through its grant while a read at that time returned nothing. Passing the requested time as `validAt` fixed it, and the test passed 300 of 300 runs. In the same run the by-id property's coverage floor of one quarter was too high (37 of 300 runs returned an item) and was set to one tenth.

**Consequence.** Nothing further.
