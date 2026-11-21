---
date: 2026-11-20
author: claude-agent
type: decision
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** I extended the lead-owned invariants file again, only to strengthen it (review finding RV7-R1). Invariant 5's grant walk now draws reviewed promotions into the team scope by the owner or a co-holder. A new guard requires co-holder promotions of granted items.

**Why.** The walk never promoted, so the critical finding sat outside it. The existing read check (every change of what an item's grants admit was its owner's) catches a co-holder's granted new version. A step check also requires that such a version carries no grant.

**Result.** Promotions retire their source under `<policy>/promotion/superseded`. That id is now admitted only for a retire that directly follows an allowed promotion of that source. Nothing else changed. With the grants kept on a co-holder's new version, the walk fails ("a co-holder's new version carries no grant").

**Consequence.** For the lead's review of the invariants file.
