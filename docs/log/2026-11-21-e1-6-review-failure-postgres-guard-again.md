---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/chain.test.ts
supersedes: none
---

**What.** The chain property's guard for a lint event about a surviving item, redacted at offboarding, failed on Postgres again.

**Why.** Postgres runs ten cases, and the generated operations reached that case by chance.

**Result.** Every run now begins with the case itself: Lee's team note cites Dana's person note, which she changes, and a lint of the team flags Lee's note naming hers. Both backends pass.

**Consequence.** The case the card names is present in every run, not hoped for.
