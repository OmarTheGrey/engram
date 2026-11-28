---
date: 2026-11-28
author: claude-agent
type: decision
card: X18
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/governance-faults/inject.ts
  - fixtures/bench/longmemeval/script.json
supersedes: none
---

**What.** Each fault's target is drawn by the seed from the clean read's items (the supersession target from B5's read before its close), and the read's query is the question's own text.

**Why.** U6 measures whether a fault changes the admitted read at limit 20. A target drawn from the whole history would mostly sit outside the read and change nothing, so the change rate would measure the limit, not the fault. The question as the query is what B5's scripted model sends (fixtures/bench/longmemeval/script.json) and needs no model.

**Result.** Deletion and supersession change the read in every targeted pair on the fixture; a base whose clean read is empty has no target, and its pairs are counted as untargeted.

**Consequence.** The change rate is conditional on the target being read; the result's limits say the read is not any recorded session's read.
