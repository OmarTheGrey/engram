---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** Review finding P50-6: invariant 1's two-handle walk never made a writer throw or fail a store call, so it could not see P50-2, and no mutant of the erased-id refusal or the new delete would fail it.

**Why.** The walk modelled interleavings, not failures between a store call and a commit.

**Result.** With crashes added, removing the erased-id refusal, the never-committed refusal or the delete each fails the walk.

**Consequence.** See the decision on crashes in the walk.
