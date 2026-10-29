---
date: 2026-10-29
author: claude-agent
type: failure
card: E2.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** The first version of the promotion generator in invariant 2 failed on its fourth case, and its guards were met only a handful of times.

**Why.** It wrote the item to promote with a model source into team scope, which source isolation refuses even under the admit-all policy, so the setup write did not land; and with the target rule opened half the time and the promoter in both scopes half the time, most cases stopped at membership or the random write rule.

**Result.** Model and compaction items are now generated in person scope only, and the target rule and the promoter's memberships are opened three times in four. Landings by confirmation went from 10 to 20 per 1000 cases and by review from 16 to 33; every guard is met.

**Consequence.** Nothing beyond the fix; the generator stays.
