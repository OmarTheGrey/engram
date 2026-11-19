---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/test/unit/dogfood-report.test.ts
  - docs/dogfood.md
supersedes: none
---

**What.** Review finding E95-5 (important): a member declaring `--member role:secret` beside their person scope made a read violation disappear, and nothing in the output showed it.

**Why.** The report judges reads under the declared actor and printed nothing about it.

**Result.** The report prints `declared`: the level, memberships counted by level and `own_scope_only`. A test shows the violation vanish under wider flags and `own_scope_only` false; the procedure tells the lead to reject a report without `own_scope_only: true`.

**Consequence.** A member can still declare wider flags, but not invisibly.
