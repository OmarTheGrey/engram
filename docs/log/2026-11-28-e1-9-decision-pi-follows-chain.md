---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/src/extension.ts
supersedes: none
---

**What.** The pi extension keeps the chain only of a log that already has a genesis; it never begins one.

**Why.** The runner's C5 sessions build the extension over scratch logs, and research runs keep no chain by design (the card's guard).

**Result.** On a scratch log the extension adds two reads at construction (the chain tables and the genesis), no write and no statement per append. Cost if wrong: a caller who wants a fresh log chained must still call keepChain, as the shared opener does.

**Consequence.** No registered run changes (see the guard finding).
