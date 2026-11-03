---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/research/preregistration.md
  - docs/tasks/prereg-v1-plan.md
supersedes: none
---

**What.** V-6: item 4 stated only that the empty checkpoints pull C4 minus C5 toward zero, and v1 called C4 "the stronger instruction condition".

**Why.** The walk's larger denied lists, which raise C4's exposure, were not weighed.

**Result.** Found by the final verification of PR #27.

**Consequence.** Item 4 states both directions; v1's wording no longer presumes which instruction condition leaks less.
