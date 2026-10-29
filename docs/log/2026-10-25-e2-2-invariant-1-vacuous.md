---
date: 2026-10-25
author: claude-agent
type: failure
card: E2.2
chapter: limitations
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/generators.ts
supersedes: none
---

**What.** With the real Plane in place, invariant 1 as written in step-0 task S0.9 passed while testing almost nothing: in its 300 seeded cases no read returned a single item.

**Why.** The same random policy gated the writes and the reads. Few writes landed (a level often has no rule; random source lists, classes and floors deny most items), two thirds of generated items are not active, and about half start after the read time, so every read came back empty.

**Result.** A probe of the seeded run counted 37 landed writes and 0 returned items. After the change in the decision entry of the same date, the run admits items by scope and by grant, and a guard fails the test if either count is zero.

**Consequence.** Any future property over the read path should count what it exercised, not only what it rejected.
