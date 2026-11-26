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
  - packages/core/test/unit/oracle-grants.test.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** Item 35's rule is built, but only half of it has a plane-level test.

**Why.** The acceptance asks for the code and the test that enforce each ADR's main rule.

**Result.** `evaluatePromotion` sets the new version's grants to `actor.id === item.owner ? item.grants : []` (`packages/core/src/policy/promotion.ts`). The non-owner half is tested through the real plane ("a reviewer's promotion carrying a grant its class switches off is no violation", `packages/core/test/unit/dogfood-report.test.ts`) and in invariant 5's promotion steps. The owner half, where the owner's class-changing promotion keeps a grant that then admits nothing, is checked only in the oracle (`packages/core/test/unit/oracle-grants.test.ts`), not through `Plane.promote` and a grantee's read.

**Consequence.** The card that builds item 34 should add that test, since the first-write rule must exempt a promotion's new version.
