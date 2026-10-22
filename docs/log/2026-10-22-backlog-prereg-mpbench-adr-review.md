---
date: 2026-10-22
author: omar
type: decision
card: none
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/backlog.md
  - docs/research/preregistration.md
  - packages/bench/PINS.md
supersedes: none
---

**What.** The lead backlogged three items: the pre-registration (v0.1 stands, v1 waits), MPBench (the request stays unsent and the fallback card waits), and the review of ADRs 0002 to 0023, which becomes a later review and flesh-out session with the team.

**Why.** Platform work on the critical path comes first, and these need the team's time.

**Result.** `docs/tasks/backlog.md` lists each item with what is left; cards R1, B2 and BF1, the pre-registration and PINS.md are marked backlogged.

**Consequence.** No experiment runs until the pre-registration leaves the backlog; the ADRs stay pending review.
