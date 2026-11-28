---
date: 2026-11-28
author: claude-agent
type: decision
card: X19
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/bench/src/residue/check.ts
  - packages/core/test/unit/plane/offboard-edges.test.ts
supersedes: none
---

**What.** U7's item in another scope that shares a store ref is a fixture event (`x19/fixture/shared-ref`) appended to the log, one per person, as the core offboarding tests build one.

**Why.** No plane path writes two items at one store ref; only the adoption of a store record that changed scope gives one ref to two items, which needs a hand edit of the store. The fixture event is in the log, so a reader sees it. One per person keeps the derived tiers per person, as U7 lists them.

**Result.** 20 team items hold a person record's ref; the offboardings keep every one, and the check counts each as `shared-store-ref`.

**Consequence.** The limits say so. Cost if wrong: how the case is built changes, not what the count means.
