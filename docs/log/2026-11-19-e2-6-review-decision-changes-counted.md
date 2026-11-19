---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/commit.ts
  - packages/core/test/unit/plane/cross-handle-review.test.ts
supersedes: docs/log/2026-11-19-e2-6-decision-check-under-lock.md
---

**What.** A change to an item, for the check under the lock and adoption's listing, is an allowed event or one of the plane's own denies that follow a store write whose decision did not stand (the four conflicts, a store failure, an adoption's deletion), never a gate's deny.

**Why.** A gate's deny changes neither the projection nor the store; the plane's own denies mark bytes that may be in the store.

**Result.** RV7 passes; counting every deny again fails RV7 on both backends.

**Consequence.** None.
