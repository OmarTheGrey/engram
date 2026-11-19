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

**What.** The lead-owned invariants file was extended, only to strengthen it. Invariant 5's grant walk now draws text rewrites by the owner or a co-holder, some moving the item, and checks on every grantee read that each allowed change of an item carrying grants was its owner's.

**Why.** The review asked that what a grantee reads was last written by its owner (RV-CORE-1). Taken literally, that forbids a legitimate flow: a co-holder edits an ungranted item, then the owner grants it. So the check is that the owner wrote it, or granted it afterwards. New guards require owner rewrites of granted items, owner moves, and refused co-holder rewrites and moves.

**Result.** It passes with the fix and fails with both owner rules reverted ("only the owner rewrites an item carrying grants, or moves an item"). Nothing was weakened.

**Consequence.** For the lead's review of the invariants file.
