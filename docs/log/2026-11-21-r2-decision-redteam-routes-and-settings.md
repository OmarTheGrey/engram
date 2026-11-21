---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - docs/tasks/X14.md
  - docs/readings/litreview/2610.14431-memform.md
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** The red-team proposal (P1) names its two entry routes "write route" and "read route" (content adopted at read), not MemForm's Selection and Path. It runs the store directly (C2's path) and C5 with each guard setting, and leaves out C1, C3, C4 and C7.

**Why.** Card X14 maps Selection to writes and Path to reads. The MemForm note defines them as retention and consolidation order, so borrowing the names would mislabel the table. In a model-free arm, C3 and C4 differ from C2 only in the prompt, and C7 has C5's write gate.

**Result.** P1 states the mapping, and defers a retention or promotion-order attack as a later extension.

**Consequence.** Card X14's step 2 should use the route names. If the lead wants MemForm's interfaces, the corpus needs sequences that AMSB does not have.
