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

**What.** V-14: v1's multiplicity line gave H2 a p at or below zero, which its support rule does not fit.

**Why.** One wording was used for four hypotheses.

**Result.** Found by the final verification of PR #27.

**Consequence.** Each primary p now follows its Test field.
