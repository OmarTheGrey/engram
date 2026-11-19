---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/reach.ts
supersedes: none
---

**What.** `packages/bench/src/faults/reach.ts` restates L3's rules for which pairs and claims its lints send (`contradictionPairs`, `unsupportedClaimUnits` on branch `l3-model-lints`), with no model call, so the set can be checked against them now.

**Why.** L3 is not on main and this branch must not merge it, yet the coordinator asked that the labels meet its rules. Restating the rules in a check is the only way to test that before L3 lands.

**Result.** The tests and the label check use it. The neighbour count, the Jaccard share over runs of letters and digits, the duplicate skip, the tie order and the claim conditions are copied from L3's code at that branch.

**Consequence.** If L3 changes its rules before merging, this check passes on stale rules. Follow-up for L4: replace `reach.ts` with L3's exports once it merges, and rerun the check.
