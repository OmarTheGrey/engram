---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
supersedes: none
---

**What.** The report prints the declared actor as `declared`: its level, its memberships counted by person, role, team and org, and `own_scope_only`, true only when the memberships are exactly the actor's own scope at its own level.

**Why.** E95-5 asked for the shape without names; counts by level show a wider declaration without naming the scope.

**Result.** The realistic report shows `own_scope_only: true`; the wider declaration shows `false` and one role.

**Consequence.** The procedure has the lead reject a report without `own_scope_only: true`.
