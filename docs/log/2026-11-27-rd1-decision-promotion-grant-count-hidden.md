---
date: 2026-11-27
author: claude-agent
type: decision
card: RD1
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/src/visible.ts
  - packages/core/test/counterexamples/read-disclosure.test.ts
supersedes: none
---

**What.** A promotion's clause "N grants of its owner X are not carried to the new version" is cut from the reason shown to anyone but the promotion's maker and the item's owner (review finding 4).

**Why.** After RD1 a member who is neither owner nor grantee is shown no grant, so the count told it what it was not shown. Cutting it is one pattern in `disclosedReason`, on the answer only: the log keeps the clause, and no research script or committed result reads a shown reason, so no MANIFEST row can move.

**Result.** The counterexample "a reviewed promotion's reason tells a member who is neither maker nor owner no grant count" passes; the maker still reads its reason whole (`write-grants.test.ts`).

**Consequence.** Costs, if wrong: a member no longer learns from the timeline that the owner's grants were dropped, which the owner still sees.
