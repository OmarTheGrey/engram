---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.7
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/counterexamples/trust.test.ts
  - packages/core/src/plane.ts
supersedes: none
---

**What.** In the lattice of card E2.7, "retire" is a rewrite of the item to status `retired` through `Plane.write`; retirement by ttl in a `Plane.retain` sweep is left out.

**Why.** The Plane has no retire call (`packages/core/src/plane.ts`, interface `Plane`), so a writer retires an item by rewriting its status. A ttl retirement is timed by the item's own writer or its rule, not by the sweeper's trust, and review finding P4-6 already limits it to the sweeper's own person scope or a user-sourced sweeper (`mayRetireByTtl`, `packages/core/src/policy/retention.ts`).

**Result.** 49 retire cells, each a status rewrite by a co-member, all allowed today.

**Consequence.** If card E2.11 wants ttl retirement inside the protection, it adds those cells itself.
