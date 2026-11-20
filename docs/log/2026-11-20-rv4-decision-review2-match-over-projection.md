---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
supersedes: none
---

**What.** For N-1, read treats a store search hit whose record no longer holds the projected content (strict hash) as stale, and matches that item over its projected content. The store record is not restored.

**Why.** Restoring the file to the plane's version, as `settle` does, would erase the owner's edit from their own Claude Code file, though the deny event names it; the person would lose what they typed with no copy outside the log's hash. Matching over the projection keeps the file as the owner left it and fixes every divergence, whatever caused it, without a new event.

**Result.** P30b passes. Mutation: never treating a hit as diverged fails it.

**Consequence.** A projected item whose store record dropped a query term is missed by that search, a recall loss, never a leak.
