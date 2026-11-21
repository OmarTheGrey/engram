---
date: 2026-11-20
author: claude-agent
type: decision
card: RV7
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** The owner's rule of RV-CORE-1 applies to a rewrite of an item carrying any grant, expired or live, not only live grants as the review worded it.

**Why.** The design rule is narrow, never widen. An expired grant admits no read, so counting it costs a co-holder only the rewrite of an item whose consent has lapsed. Judging liveness would need the write's time inside the gate, and `evaluateWrite`'s time is optional for its promotion caller.

**Result.** The case is a test: a co-holder's rewrite of an item whose grants have all expired is denied with `engram/grant/owner`.

**Consequence.** If the lead wants live grants only, the check takes the time and calls `liveGrants`. The test changes with it.
