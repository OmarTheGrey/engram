---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** Review finding I2 of PR #44: the invariants' random walk never called `changeGrants`, so no invariant checked reads after grant changes.

**Why.** Only the surface check knew the method; invariant 5's walk wrote, read, swept and adopted, under a policy that did not honour grants.

**Result.** Fixed by decision `2026-11-19-e9-4-review-decision-invariants-grant-walk.md`. Mutants that let the owner's agent change grants, or let the read filter ignore a grant's expiry, each fail invariant 5.

**Consequence.** The lead's second review of the invariants file.
