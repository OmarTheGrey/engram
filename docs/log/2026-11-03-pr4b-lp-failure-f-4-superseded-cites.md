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

**What.** F-4: item 14's Evidence cited three entries that later entries supersede.

**Why.** The chain moved on after the citations were written (part A's final fix round, the blind kit, part B's final round), and no check followed.

**Result.** Found by the last verification of PR #27 or the final verification before it.

**Consequence.** Item 14 cites the chain heads, and a script over every `supersedes` field finds no superseded citation left in the sheet, v1 or section 7.
