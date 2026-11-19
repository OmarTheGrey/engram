---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/grants.ts
  - packages/core/src/plane/promote.ts
supersedes: none
---

**What.** The erasing and erased-id refusals run only after the gate allowed, so `Plane.checkWrite` gives the same decision and a caller the gate refuses never learns that a scope is being erased.

**Why.** Their reasons name the person scope, which only a member that the gate let through may learn (finding N3 of the PR #5 review).

**Result.** An outsider writing under an erased id gets the opaque reason, a member the specific one (test in the cross-handle file).

**Consequence.** None.
