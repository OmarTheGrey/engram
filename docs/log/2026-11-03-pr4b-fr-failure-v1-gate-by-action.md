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

**What.** V-3: v1 said `make h1-table GATE_BY_ACTION=1` gives the wrong-action reading beside the table, but the command rebuilt the primary table in place.

**Why.** The text described the reading, not what the command wrote.

**Result.** Found by the final verification of PR #27.

**Consequence.** D2: a separate sessions file, config and table, each carrying the flag.
