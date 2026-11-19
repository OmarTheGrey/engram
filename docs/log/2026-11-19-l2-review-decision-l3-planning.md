---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/scripts/fault-set-check.ts
  - packages/core/src/plane/lint.ts
supersedes: docs/log/2026-11-19-l2-decision-reach-mirror.md
---

**What.** The model-tier check calls core's `planModelLints` (card L3, merged at `02bd0f1`) over each state and reads pairs and claims from the unit ids (`contradiction:<earlier>+<later>`, `unsupported-claim:<claim>`); the copy of L3's rules in `packages/bench/src/faults/reach.ts` is deleted.

**Why.** Review finding L2-5: once L3 merged, a copy could only drift from it. The planning also applies L3's merged `heldAt` rule to sources, which the copy did not.

**Result.** The same call under preset medium with every lint enabled gives the labelled units medium would not send.

**Consequence.** Any change to L3's selection shows in the label check at once.
