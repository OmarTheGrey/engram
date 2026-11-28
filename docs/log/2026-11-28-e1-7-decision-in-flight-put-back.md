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

**Why.** After the fix the put-back writes the item back and, once it finds the item erased, deletes it; the state between is like a settling writer's.

**Result.** Correction after review: a put-back stopped right after its write (`obStop`, standing for a crash, the failed delete or the fourth round's give-up) IS counted: `erasureHolds` is false there, and `putBackCrashReplayTest` (specs/replay.qnt) pins it. Seed 1's three-offboarding simulation passes only because it reaches the put-back in 4 of 5,000 traces and never that stop; no targeted seed or deeper Apalache bound was added (Apalache's depth 4 cannot reach a third erasure).

**Consequence.** A known limit with a recovery path in the model (the next adoption purges); in the code see finding put-back-delete-throws.
