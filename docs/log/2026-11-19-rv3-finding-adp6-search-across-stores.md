---
date: 2026-11-19
author: claude-agent
type: finding
card: RV3
chapter: discussion
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/src/files/index.ts
  - packages/adapters/src/letta/index.ts
  - packages/adapters/src/mem0/index.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** The repository review's finding RV-ADP-6: one `Plane.read` query returns different items over stores that differ only in their search method. Left to the lead, not changed here.

**Why.** The files and Letta adapters scan and keep an item only when every query term is in its content; the Mem0 adapter ranks by embedding similarity above a threshold; the fake can offer no search at all. ADR 0013 lets `search` be optional and says nothing about what a hit means, so the same read differs by store (the reviewer's probe `searchsem.mts`).

**Result.** No code changed. Choosing one meaning (every term, any term, or the store's own ranking with the plane's filter on top) changes what a read returns on each store, so it bears on any comparison across stores; the card's brief leaves it to the lead.

**Consequence.** A backlog row for the lead.
