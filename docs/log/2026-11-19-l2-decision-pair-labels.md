---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/labels.ts
supersedes: none
---

**What.** A pairwise fault is labelled on one item, with its counterpart in `related`: the superseded statement (related: the later update), and the conflicting restatement (related: the first statement). Whether a finding on the related item counts is left to the scorer.

**Why.** A contradiction lint may report either item of a pair, and card L3's finding shape is not fixed yet; labelling both items as faults would count one fault twice.

**Result.** Notes carry their cited source in `related`, so a scorer can also read source-changed and orphan evidence against it.

**Consequence.** L4 states its matching rule for pairs; if L3 reports pairs as one finding with both ids in its evidence, the rule is direct.
