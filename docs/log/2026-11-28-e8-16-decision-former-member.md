---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.16
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/server/test/leakage-kit.ts
supersedes: none
---

**What.** The former member is fred after `offboard` erased his person scope, probed as the harness presents him after: without team:x, the scope he wrote to and left.

**Why.** Memberships are self-asserted without credentials (ADR 0027): a leaver who still asserts the scope is a member by assertion, which only verified actors (card E8.12) close. The suite tests what the plane decides given the memberships it is told.

**Result.** Fred sees none of team:x, including the item he wrote there; nobody sees his erased item's content on any surface.

**Consequence.** Stated in the result's limits. A probe of credential-bound memberships belongs to E8.12's surfaces.
