---
date: 2026-11-21
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/L6.md
  - packages/core/src/supersede.ts
supersedes: none
---

**What.** Retired versions are left out of the chain walk, except the item asked about, and a retired new item proposes nothing.

**Why.** A retired holder's lineage supersedes nothing elsewhere in core (items.ts).

**Result.** The property test 'a retired new item proposes nothing'.

**Consequence.** None.
