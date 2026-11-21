---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - docs/research/preregistration.md
  - docs/readings/litreview/2610.30698-governance-state-corruption.md
  - research/results/h3-fault-set.json
supersedes: none
---

**What.** The paired fault-injection proposal (P5) applies each of the paper's three operators (deletion, temporal supersession, missing metadata) in two places, the projection and the log. That gives one fault per base, operator and place: 3,000 pairs over LongMemEval's 500 questions.

**Why.** In the paper, the enforced state is restored by an oracle. In Engram it is the plane's own recovery: replay restores a projection fault, so that fault is recovered by construction, while a log fault leaves only the lints, and later the chain check of card E1.6.

**Result.** P5 reports recovery of projection faults as a regression check, not as evidence. The log faults carry the arm's information.

**Consequence.** If the lead wants only one place, the size halves and the by-construction caveat disappears or becomes the whole arm.
