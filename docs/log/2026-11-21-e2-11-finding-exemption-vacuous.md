---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.11
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/trust.ts
  - packages/core/src/policy/promotion.ts
supersedes: none
---

**What.** ADR 0040's exemption for the owner acting as `user` never changes a decision under core's order.

**Why.** The exemption is implemented and tested, so the question is whether it does anything.

**Result.** `user` is first in `TRUST_ORDER`, so a user-sourced writer is never less trusted than any item; protection already lets the owner, and any user-sourced member, act. It would matter only if an order put a kind above `user`.

**Consequence.** Nothing now; the lead may read decision 4 as documentation.
