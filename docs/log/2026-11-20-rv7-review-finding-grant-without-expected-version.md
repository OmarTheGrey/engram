---
date: 2026-11-20
author: claude-agent
type: finding
card: RV7
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/grants.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Review finding RV7-R6 (design): `Plane.changeGrants` takes no expected version. The owner can therefore grant an item whose text a co-holder rewrote while it carried no grant, text the owner never saw.

**Why.** RV-CORE-1 makes a rewrite of a granted item the owner's only. An ungranted item stays open to co-holders, as ADR 0006 allows, and a later grant change judges only who asks.

**Result.** No code change, as the review asked. This is a backlog row, "A grant over text the owner never saw", and ADR 0034's amendment names it. An expected version on the call, refused when the item has moved on, would close it.

**Consequence.** For the lead.
