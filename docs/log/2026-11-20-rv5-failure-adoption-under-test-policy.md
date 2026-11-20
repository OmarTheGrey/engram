---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/before-read.test.ts
  - packages/core/test/unit/plane/helpers.ts
supersedes: none
---

**What.** The first unit test of `syncBeforeRead` found a retire event after a non-owner's read, which looked like the finding still open.

**Why.** It was adoption, not a sweep: the core tests' `testPolicy` allows no `import` source, so adopting the owner's own item as the store's owner was denied and the plane retracted the version it held (`engram/adopt/retract`).

**Result.** The test runs under the medium preset, which admits imports; no retire event follows a non-owner's read. Under a policy that refuses imports, every read still retracts the store's own items, whoever reads; that is adoption's rule (card RV4's file), not this card's.

**Consequence.** Card RV4 may want to know that a read by anyone triggers a retraction under such a policy.
