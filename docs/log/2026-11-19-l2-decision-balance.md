---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/configs/h3-fault-set.json
  - packages/bench/src/faults/generate.ts
supersedes: none
---

**What.** Every question gets one fault and one near-miss of each subtype (`per_question: 1`), placed at seeded anchor turns, with each question's stream seeded by the set's seed (20261119) and its question id.

**Why.** A balanced design gives every class and subtype the same count, so per-class intervals have the same size; seeding per question keeps a question's faults the same whichever questions a set holds.

**Result.** 18 labels per question, 9,000 on the full split; within a question no attribute is used by two groups, so injected items never contradict each other by accident.

**Consequence.** If wrong: `per_question` raises the count (up to three, by the invented attribute bank's size) without changing the generator.
