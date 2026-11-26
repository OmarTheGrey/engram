---
date: 2026-11-25
author: claude-agent
type: finding
card: ANS-2026-11-25
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/test/unit/plane/write-grants.test.ts
  - packages/core/test/property/invariants.test.ts
supersedes: docs/log/2026-11-25-ans-2026-11-25-finding-adr-0034-owner-promotion-untested.md
---

**What.** Both halves of item 35 are tested through `Plane.promote`, which corrects the earlier entry that said the owner half was checked only in the oracle.

**Why.** The card's review (finding ANS2-1) found the owner test that entry missed.

**Result.** `evaluatePromotion` sets the new version's grants to `actor.id === item.owner ? item.grants : []` (`packages/core/src/policy/promotion.ts`). In `packages/core/test/unit/plane/write-grants.test.ts`, line 425, "RV7-R1: a co-holder's promotion of the owner's granted item into another scope carries no grant", tests the non-owner half. Line 435, "RV7-R1: the owner's own new version keeps the grants", tests the owner half. Mutating the rule to `grants: []` fails it. One possible gap remains: no plane-level test reads as the grantee after the owner's class-changing promotion to show the kept grant admits nothing. Invariant 5's read oracle may cover it; this is unverified.

**Consequence.** Card E2.21 may add that grantee read. No duplicate owner test is needed.
