---
date: 2026-11-26
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/X20.md
  - docs/tasks/X21.md
  - docs/tasks/R5.md
  - docs/tasks/R6.md
  - docs/tasks/X22.md
  - docs/tasks/X23.md
  - docs/tasks/L10.md
  - docs/tasks/E9.17.md
  - docs/roadmap.md
  - docs/log/2026-11-26-gwfix-decision-x20-stops.md
supersedes: none
---

**What.** The fix pass on the eight gate-work cards after their review (4 high, 10 medium, 9 low). X20 takes the orchestrator's stops, counts refused utility sessions by reason in `h1.py`, writes one ledger line per refusal and, merging second, closes condition 3 in the pre-registration. X21 is built, merges first, and names `capped_utility`. R5 adds a second config assertion and `label-audit.md`; R6 pins `.judge` only where a judge is called, puts the chosen-for field on `OpenRouterProvider` and prefers seed-honouring endpoints. X22, X23 and L10 take the review's fixes. Every card lists its backlog row; the roadmap gives X20 and X21 30 November and X22, X23 and L10 H1's `MERGE=4`.

**Why.** R5, R6, X20 and X21 are being built from these cards now.

**Result.** One commit per card. X21-1 and X21-2 are left to X21's own review.

**Consequence.** The cards match what their implementers were told.
