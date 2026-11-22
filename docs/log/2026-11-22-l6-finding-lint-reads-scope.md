---
date: 2026-11-22
author: claude-agent
type: finding
card: L6
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/lint.ts
supersedes: none
---

**What.** `Plane.lint` decides which items a finding may name by `readableAt` (plane/lint.ts, `canReach`), which checks scope or grant only, the same test L6-1 replaced in the plan.

**Why.** The reviewer of L6 noted it. Lint findings may then name or describe candidates, retired, expired or not-yet-valid items the read filter refuses.

**Result.** Not changed: lint feeds registered H3 runs, and a change would move their results.

**Consequence.** For the lead: whether lint should read through `evaluateRead` after the pre-registration tag, as its own card.
