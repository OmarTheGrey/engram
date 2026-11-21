---
date: 2026-11-20
author: claude-agent
type: change
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/generators.ts
  - packages/core/test/property/read-leak.test.ts
  - packages/core/test/property/read-pipeline.test.ts
supersedes: none
---

**What.** A new arbitrary, `arbGatedItemWithValidTo`, draws a validity window that ends half the time: at an instant from the pool, or a second or a year after its start. The read-leak and read-pipeline properties use it (core review finding RV-CORE-7).

**Why.** No property drew a non-null `valid_to`. The review named read-reason as the second user, but that property draws read counts, not items, so read-pipeline takes its place.

**Result.** read-pipeline now also reads at the very end of one item's window in a quarter of its runs. It checks every returned item against the window without the implementation's helpers. The boundary mutant (`valid_to >= at` admitted) survived every property before and now fails read-pipeline. read-leak has a guard for items whose window ended.

**Consequence.** The other properties keep `arbGatedItem` and draw as before.
