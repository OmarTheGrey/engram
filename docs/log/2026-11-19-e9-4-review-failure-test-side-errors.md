---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/grants.test.ts
  - packages/core/test/property/grants.test.ts
supersedes: none
---

**What.** Four test-side mistakes on the way through the review fixes, each found by a failing run.

**Why.** The race test expected the conflict reason to say "erased" where the first wording said "removed"; the property's oracle judged a rewrite's grants by the item's provenance, not by the kind the rewriter's source sets; its opaque-refusal check failed when the actor was itself the owner; and one mutant (`Math.random() > 2`) changed nothing.

**Result.** The reason says "erased or removed"; the oracle uses the effective kind; the check strips the actor's own id first; the mutant was redone so it always applies, and it failed both race tests.

**Consequence.** Mutants are now checked to apply before their result is read.
