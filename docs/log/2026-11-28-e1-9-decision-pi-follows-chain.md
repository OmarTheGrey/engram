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

**Result.** The check runs when the extension is built and again before every Plane call that may append (review finding 2), two reads, none once the handle keeps the chain; no write on a scratch log. Left: a chain begun between that check and the append it precedes leaves that one event unchained, and the log verifies FAILED at it; opening through openWorkspace, as the pi package does, has no such window. Cost if wrong: a caller who wants a fresh log chained must call keepChain.

**Consequence.** No registered run changes.
