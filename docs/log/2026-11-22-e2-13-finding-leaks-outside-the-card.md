---
date: 2026-11-22
author: claude-agent
type: finding
card: E2.13
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
  - packages/core/src/policy/grants.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Two leaks outside this card, confirmed by its review, recorded and not fixed. First, item 36 is a live leak on main: `Plane.read` returns every grant on an item to a grantee, so it learns every other holder; only the inspector's `shownGrants` hides them. Second, `evaluateGrantChange` (`policy/grants.ts`, the owner check near line 104) refuses a non-owner member of the scope with "only its owner <id> may change the grants", naming the owner even of an item closed to that member.

**Why.** Card E2.13 is scoped to who-can-read; both are read and grant-change paths the lead owns.

**Result.** `whoCanReadItem` withholds both from its own answer. The read path and the grant-change refusal still give them.

**Consequence.** For the lead: item 36's backlog row, and a matching withholding in the grant-change refusal.
