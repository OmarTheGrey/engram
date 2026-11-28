---
date: 2026-11-28
author: claude-agent
type: decision
card: D5
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/lint/procedural.ts
  - docs/tasks/D5.md
supersedes: none
---

**What.** A hold is released by any user-sourced actor who presents the candidate again with a reason; ADR 0026's reviewer rule (not the owner, not an author) is not added.

**Why.** The card says "a user-sourced actor with a reason". A replay is already presented only by a user-sourced actor (D3), and the distiller that writes a candidate acts with source model, so the agent can never release its own procedure.

**Result.** `applySafetyScan` refuses a release by another source under `engram/promote/safety-scan`; the release reason is stored trimmed in the allow event's reason.

**Consequence.** If wrong: A person may release a held procedure their own agent distilled without a second pair of eyes; requiring a reviewer is one condition in `applySafetyScan`.
