---
date: 2026-11-28
author: claude-agent
type: decision
card: X19
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/bench/src/residue/check.ts
  - packages/core/src/policy/promotion.ts
  - fixtures/profiles/offboarding.json
supersedes: none
---

**What.** U7's item promoted to a team scope is promoted, with review, by a reviewer the harness makes a member of every person scope and of the team (`person:reviewer`).

**Why.** Under twin a widening out of a person scope needs a user-sourced reviewer who belongs to the item's scope and is not its owner; only the owner belongs to a person scope unless the harness says otherwise (ADR 0027). The owner's own promotion is answered with a request for review, and a grantee is refused.

**Result.** 20 promotions allowed, one per person, of slot 3's fact.

**Consequence.** The limits say so. Cost if wrong: the promoted tier would need another policy.
