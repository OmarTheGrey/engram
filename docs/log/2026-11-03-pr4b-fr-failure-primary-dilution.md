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

**What.** V-12: item 9 weighed the forgetting set's dilution but not the primary set's, and said the empty checkpoints add no difference.

**Why.** 282 of 727 access-control checkpoints have a readable leak pattern (`research/results/h1-gatemem-reach.json`), and that was not weighed.

**Result.** Found by the final verification of PR #27.

**Consequence.** Item 9 weighs it and uses v1's wording.
