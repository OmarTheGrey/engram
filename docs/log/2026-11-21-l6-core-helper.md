---
date: 2026-11-21
author: claude-agent
type: change
card: L6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/supersession.ts
  - packages/core/src/lint/intervals.ts
  - packages/core/src/supersede.ts
  - packages/core/test/property/supersede.test.ts
  - "make test-one T=packages/core/test/property/supersede.test.ts"
supersedes: none
---

**What.** Core gained the supersession proposal (`proposeSupersession`), the Allen interval helper, the cycle-safe head resolver over lineage, and the plan (`planSupersession`, `acceptedClosures`, `closedVersion`), in commit 9e089a33.

**Why.** STALE and the revocation study show stores leaving an old fact valid once a newer one arrives; Engram had `valid_to` and lineage and nothing that proposes an end date.

**Result.** The acceptance command passes: 1 file, 4 tests (resolver 2000 runs, proposals 3000, a retired new item 300, versions through the real Plane 40). The 61 unit and property tests of the five new files pass, and `make test-invariants` passes 17 of 17. Disabling the clash branch and the cycle check each fails the property test with a counterexample.

**Consequence.** The surfaces apply a close through `Plane.write`. Nothing in the read path calls the helper.
