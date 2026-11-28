---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.19
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/plane/approvals.ts
  - docs/tasks/E2.19.md
supersedes: none
---

**What.** A request opens at a held write (an allowed write or update leaving a candidate) as well as at the `gate` ask the card's goal names; a later ask joins it.

**Why.** Under the knowledge profile every team and org write is a candidate. A queue of asks alone would be empty until someone tried to promote, and the card's own reason, someone has to see the queue, would fail.

**Result.** The key is still id and version, so no event field is added.

**Consequence.** If wrong, held writes drop out of the projection and the queue shows asks only; nothing else changes.
