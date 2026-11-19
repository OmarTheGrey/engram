---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** Finding V3-1: a promotion's new version of an erased item, written under a fresh id, crashed after its bytes landed and was adopted after the offboarding, so Dana read the erased sentence again; promoted to a team scope, the sweep never saw it.

**Why.** Erasure and adoption traced erased content by id only, and the sweep listed only the person scope.

**Result.** Probes Q2a and Q2b failed before the fix and pass after; Q2c and Q2d cover the sweep and a write.

**Consequence.** See the decision on lineage.
