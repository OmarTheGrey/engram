---
date: 2026-11-25
author: claude-agent
type: decision
card: RD1
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/visible.ts
  - packages/core/test/counterexamples/read-disclosure.test.ts
  - docs/tasks/lead-decisions.md
supersedes: none
---

**What.** A member of an item's scope who is neither its owner nor a grantee is shown no grant on it: the one rule is "the owner sees all, anyone else only the grants whose `to` names it", expired or not.

**Why.** The card left it open. Least disclosure, one rule for every non-owner, and the same rule as item 53's who-can-read answer and the inspector's `shownGrants`. "Owner" is as `Plane.changeGrants` knows it: the item's owner id and a member who may read its scope.

**Result.** lee, a team member, reads dana's granted item with `grants: []` (`read-disclosure.test.ts`, "lee's none"). A grant change's reason, which names grantees, is shown whole only to its maker and the owner; others see that the owner changed the grants.

**Consequence.** A member learns who else may read an item only from the owner.
