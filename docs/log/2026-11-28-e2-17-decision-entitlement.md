---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - docs/decisions/0047-by-id-read-and-scope-list.md
supersedes: none
---

**What.** An answer is given exactly when ADR 0047's by-id rule (`idShownTo` in visible.ts) lets the actor ask for the item: projected, and in a scope it may read as a member or admitted to it by the read filter at the read's times. Anyone else gets one refusal, word for word but for the id, also given for an id the log never held.

**Why.** The card requires that the answer never be an existence oracle; reusing RD1's rule keeps it the same as a by-id read's.

**Result.** An entitled actor can never be excluded by reach or access, so those stages are never named. A grantee whose grant expired is refused as for an unknown id, as readById answers it.

**Consequence.** If wrong, the rule lives in one call; widening it needs a lead decision.
