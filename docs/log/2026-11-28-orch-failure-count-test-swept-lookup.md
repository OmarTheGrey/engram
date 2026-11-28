---
date: 2026-11-28
author: claude-orchestrator
type: failure
card: E1.7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/bench/count.test.ts
  - "make test-one T=packages/core/test/bench/count.test.ts"
supersedes: none
---

**What.** Main was red after card E1.7 (#154): `count.test.ts` pins the statements one call runs, and a write now runs 17 statements and 18 prepares, not 16 and 17, under every preset. The pin and its comment are updated.

**Why.** E1.7 added the lookup that refuses a write under an id an offboarding swept (`plane/write.ts`). The test passes at E1.7's parent and fails at its merge; neither the agent nor the orchestrator ran this file before merging.

**Result.** 9 of 9 pass. The statements still do not grow with the store; rows read are unchanged.

**Consequence.** Before each merge the orchestrator runs the whole core project (`vitest run --project @engram/core`), not only a card's own files.
