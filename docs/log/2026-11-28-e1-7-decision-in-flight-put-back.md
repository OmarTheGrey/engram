---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.7
chapter: design
pillar: research
hypothesis: none
evidence:
  - specs/commit.qnt
supersedes: none
---

**What.** Property 2's `inFlightOn` counts a handle in the put-back (`obPutBackRead`, `obPutBackWrite`, `obPutBackCheck`) as a call that will remove erased content it holds.

**Why.** After the fix the put-back writes the item back and, once it finds the item erased, deletes it; the intermediate state is like a settling writer's.

**Result.** `threeOffboardings` passes its test and seed 1's simulation with it. A put-back stopped by `obStop` after its write is not reached in 5,000 traces; adoption would purge that record.

**Consequence.** Cost if wrong: a stopped put-back's leftover is not counted as a violation.
