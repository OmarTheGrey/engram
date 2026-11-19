---
date: 2026-11-19
author: claude-agent
type: decision
card: L3
chapter: evaluation
pillar: plane
hypothesis: H3
evidence:
  - fixtures/faults/model
  - research/configs/l3-pilot.json
  - packages/core/scripts/faults.ts
supersedes: none
---

**What.** Until card L2's seeded-fault set lands, the L3 pilot set is L3's own model fault catalogue: four fixtures under fixtures/faults/model/, each declaring the units the lint must send and a correct judge's verdict.

**Why.** L2 is built in parallel; the card's acceptance needs a pilot set now, and the testing convention needs a flag and a near-miss fixture per lint.

**Result.** 17 units per seed: 12 contradiction pairs, 5 claims. The subdirectory keeps L1's catalogue test unchanged. Each call's cache context is (faults/<fixture>, lint, the fixture policy, none).

**Consequence.** When L2 lands, the pilot config's data should point at its set (or a subset), and the count must be redone.
