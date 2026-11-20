---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/rv4-review.test.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** Review finding I-3 of PR #58: a hand-edited record in a scope whose policy refuses the `import` source was denied, and the plane's approved item was retired (P21 on the twin profile's team scope, P23 on a person scope under a policy refusing import).

**Why.** Card RV4 made every edited record `import` at most. Adoption retracts the plane's item whenever the store's version is denied, so a scope that refuses `import` lost its approved item on any edit.

**Result.** A deny caused only by the source adoption set now leaves the plane's item standing (decision entry). P21: denied 1, retired 0, status candidate; P23: the user's item stays active, the agent's edit lands as `model`.

**Consequence.** Two tests, one per case; a third pins that a deny for anything else (a confidence below the floor) still retracts.
