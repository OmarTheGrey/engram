---
date: 2026-11-19
author: claude-agent
type: finding
card: L2
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-fault-set.json
  - packages/bench/scripts/fault-set-check.ts
supersedes: none
---

**What.** LongMemEval's own turns carry faults nobody seeded: repeated turns, and, in their text, updates and conflicts.

**Why.** The label check runs card L1's lints over every state; the generator labels only what it injects.

**Result.** On the full set, the duplicate lint, which no subtype measures, flags 968 of LongMemEval's own turns; every other deterministic finding is on a labelled fault (`research/results/h3-fault-set.json`, `label_check`). Content-level faults in upstream text (the knowledge-update questions change facts on purpose) cannot be counted without a model and are not labelled.

**Consequence.** L4's deterministic precision is exact on the measured lints. A model-based finding on an unlabelled base item is not necessarily false: L4 should report model-tier precision on injected items and on base items apart, or audit a sample by hand.
