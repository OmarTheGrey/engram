---
date: 2026-11-21
author: claude-agent
type: failure
card: E1.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/stateful.test.ts
  - "ENGRAM_STATEFUL_SEEN=1 make test-one T=packages/core/test/property/stateful.test.ts"
supersedes: none
---

**What.** The reworked model first missed its promotion floor (20, then 28 allowed promotions) because every episodic item was born past its ttl under the tight policy.

**Why.** Items carried `valid_from` 2026-10-01 while the clock starts on 2026-11-19, so a 30-day ttl had run out at the write; promotions of episodic items were refused as expired, and about 240 promotions named no candidate at all.

**Result.** New items take the clock as `valid_from`; HR is a member of both person scopes, so it can review Lee's items too; promotions name only active person items. Allowed promotions rose to 45 in the default run. `ENGRAM_STATEFUL_SEEN=1` now also prints denials by op and rule, which is how this was found.

**Consequence.** None beyond the fix.
