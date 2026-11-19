---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/generate.ts
  - research/results/h3-fault-set.json
supersedes: docs/log/2026-11-19-l2-decision-assistant-model.md
---

**What.** The set keeps naming the assistant turns' model (`longmemeval/assistant`), and now records how many turns L1's missing-provenance lint would flag without the name: `base.missing_provenance_as_b5_writes_it`, counted per question by L1's `missingProvenance` on B5's own items.

**Why.** Review finding L2-1 allows the name if the count is recorded. Without it, those findings would be almost half the set's base items, every one a true positive by L1's definition and none a seeded fault, so they would swamp the base-item audit and say nothing about natural mistakes the lint makes. With it, the base-item findings left to audit are the ones whose truth is open.

**Result.** 124,334 of 246,750 turns (`research/results/h3-fault-set.json`).

**Consequence.** If wrong: drop the name, and the label check counts them as base-item findings; nothing else changes.
