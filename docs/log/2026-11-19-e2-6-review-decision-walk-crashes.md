---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - make test-invariants
supersedes: none
---

**What.** Invariant 1's two-handle walk now crashes writers at their commit or at a repair's store call, adds a short walk aimed at a crash racing an erasure, and requires after the next adoption that the store holds no erased id and only records the log allowed; nothing was weakened.

**Why.** The review asked that the walk fail if adoption's erased-id refusal or the new delete were removed.

**Result.** 300 runs pass; removing the erased-id refusal, the never-committed refusal or the delete each fails it. Guards also require crashes, deletions and an erased record left before the adoption. Store and projection are compared only in walks without a crash.

**Consequence.** The lead's second review covers the change.
