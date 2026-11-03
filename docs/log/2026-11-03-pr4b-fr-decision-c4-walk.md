---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/results/h1-c4-walk.json
supersedes: docs/log/2026-11-03-pr4b-decision-c4-walk.md
---

**What.** Recommended, for the lead's decision: C4 on GateMem walks to C5's list (decision sheet item 4), with its bias stated both ways.

**Why.** the final verification of PR #27 (V-6): the sheet named only the bias toward zero.

**Result.** On the 28 checkpoints the plane admits nothing, C4 shows nothing, as C5 does, pulling C4 minus C5 toward zero; on access control the walk shows 3,511 denied leak-target items on 574 checkpoints against 1,797 on 567 in C3's top 20 (`research/results/h1-c4-walk.json`), raising C4's exposure, which favours H1. The union of C3's top 20 and the walk is added as an alternative.

**Consequence.** v1 no longer calls C4 "the stronger instruction condition"; which instruction condition leaks less is reported.
