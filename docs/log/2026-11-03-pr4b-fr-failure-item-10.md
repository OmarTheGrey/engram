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

**What.** V-4: item 10 treated GateMem's rule scorer as deciding sessions and offered judging alone as an alternative, but H1's run already judges every GateMem row.

**Why.** The fallback in the converter was read as live behaviour without checking `run.ts`.

**Result.** Found by the final verification of PR #27.

**Consequence.** Item 10 rewritten; the false alternative dropped.
