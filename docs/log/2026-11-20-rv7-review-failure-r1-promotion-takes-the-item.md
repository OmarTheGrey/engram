---
date: 2026-11-20
author: claude-agent
type: failure
card: RV7
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/test/unit/plane/write-grants.test.ts
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** Review finding RV7-R1 (critical): a co-holder could take the owner's granted item by promoting it. Lee, a member of `role:release` and `team:x`, promoted Dana's granted role item into `team:x` with review. The new version kept the grant to Sam, Dana read nothing, and neither of them could remove the grant.

**Why.** RV-CORE-1 and 2 judged rewrites under the same id. A promotion to another scope is a new id, and the ADR 0006 amendment wrongly said promotion was unaffected.

**Result.** A new version made by anyone but the owner now carries no grants, and the promotion's reason names those not carried. The repro is in `write-grants.test.ts`, and invariant 5's grant walk now draws reviewed promotions by the owner and a co-holder. Mutation check: keeping the grants fails both.

**Consequence.** ADR 0006's sentence is corrected, and ADR 0034's amendment is extended.
