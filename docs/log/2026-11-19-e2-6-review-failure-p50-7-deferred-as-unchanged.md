---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/server/src/contract.ts
supersedes: none
---

**What.** Review finding P50-7: adoption counted a record it left to the next adoption under `unchanged`, which says the projection already holds it.

**Why.** The first pass avoided changing the HTTP contract's AdoptReport.

**Result.** AdoptReport now has `deferred`, in the contract, the generated client (`make api`) and `engram read`'s output when non-zero.

**Consequence.** None.
