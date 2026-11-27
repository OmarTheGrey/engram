---
date: 2026-11-27
author: claude-agent
type: change
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/counterexamples/read-disclosure.test.ts
  - packages/core/src/visible.ts
supersedes: none
---

**What.** Three tests pin the half of the lineage rule that shows a grantee an ancestor the read filter admits only through a live grant, and the read's `valid_at` in it (review finding 3).

**Why.** In every earlier case an ancestor was either in a readable scope or not admitted at all, so dropping the `evaluateRead` disjunct of `idShownTo`, or its `validAt` argument, failed nothing.

**Result.** Dana's team ancestor, granted to sam and valid until 15 October, is named in sam's by-id read at `valid_at` 10 October and dropped at 1 November and at the read's own time. Mutations, each restored: no `evaluateRead` disjunct fails 2 tests; `validAt` ignored fails 1. The file: 20 passed.

**Consequence.** Nothing further.
