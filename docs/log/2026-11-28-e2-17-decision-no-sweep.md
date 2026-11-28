---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/routes.ts
supersedes: none
---

**What.** The route runs no store sweep or adoption first, unlike /read: the answer is over the projection as it stands, at the server's clock, with the body's `at` as the validity time.

**Why.** The card says no event is written; a sweep or an adoption appends events and changes items.

**Result.** The answer is the stage the read would apply now if nothing new is in the store; a pending adoption is not reflected until a read runs it.

**Consequence.** If wrong, a caller reads first, then asks.
