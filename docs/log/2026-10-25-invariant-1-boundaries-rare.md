---
date: 2026-10-25
author: claude-agent
type: failure
card: E2.2
chapter: limitations
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/property/read-leak.test.ts
  - packages/core/test/generators.ts
supersedes: none
---

**What.** The first strengthened invariant 1 and the first read-leak property passed while still missing the cases they were written for.

**Why.** Colliding timestamps alone left too few grant boundaries: an expiry equal to the read time had to coincide with a grant naming the reader, of the item's class, on an active and valid item. Likewise hidden items rarely shared a searched scope and a query word with visible ones.

**Result.** With colliding instants only, the run met 0 grants expiring at the read time and the `>=` expiry mutant survived; the leak property met hidden search hits in 14 of 500 cases, and the relevance-over-all-hits mutant survived it. Generating cases around one chosen grant, and items sharing a common word in bridged scopes, killed both.

**Consequence.** A guard should count the exact condition a mutant needs, not a proxy for it.
