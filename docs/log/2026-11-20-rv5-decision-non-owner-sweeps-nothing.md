---
date: 2026-11-20
author: claude-agent
type: decision
card: RV5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/before-read.ts
supersedes: none
---

**What.** A read by anyone but the store's owner sweeps nothing; the review offered "or budgets only" as the alternative.

**Why.** The write path already keeps every budget after each write (ADR 0025 decision 3), reads exclude expired items whoever sweeps (decision 2), and a non-owner's read that appends evict events in the owner's scope is what the finding objected to.

**Result.** The RV-SRF-1 tests count zero retire and evict events after a non-owner's read, at a future `at` and at a later server clock alike.

**Consequence.** Expired items in the owner's scope are retired on the owner's next read or `engram retain`, as before. Cost if wrong: none for safety; a budget overage left by adoption waits for the owner.
