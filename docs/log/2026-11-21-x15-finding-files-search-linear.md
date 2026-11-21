---
date: 2026-11-21
author: claude-agent
type: finding
card: X15
chapter: limitations
pillar: plane
hypothesis: H2
evidence:
  - research/results/h2-perf-budget.json
  - packages/adapters/src/files/index.ts
supersedes: none
---

**What.** The files adapter's search reads every file in the memory folder on each read, so a governed read over it costs far more than the plane does.

**Why.** Card X15 timed Plane.read over the files adapter beside the fake.

**Result.** At 100 items the files adapter's read median is 0.25 to 0.97 s across presets, against 5.7 to 7.5 ms on the fake; at 1,000 items 0.93 to 1.52 s against about 21 ms (`research/results/h2-perf-budget.json`). Allowed writes cost 10 to 28 ms at the median, 1.2 to 2.4 times the fake's. The spread across presets, which do the same search, shows how loaded the machine was.

**Consequence.** The files adapter is not measured at 10,000 items (about ten seconds a read). An index in the adapter is a store-side change, outside this card; the budget judges the plane on the fake only.
