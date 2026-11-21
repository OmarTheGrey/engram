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
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/read.ts
  - packages/core/test/bench/count.test.ts
supersedes: none
---

**What.** Every Plane call costs time linear in the item projection while its query count stays constant.

**Why.** Card X15 counted the queries per call and timed the calls as the store grew.

**Result.** The queries do not change with size (16 statements per write, 6 per denied write, 16 per read, asserted at 100 and 400 items), yet on the fake under medium a denied write's p50 goes from 4.4 to 12.4 to 78.6 ms at 100, 1,000 and 10,000 items (`research/results/h2-perf-budget.json`). The cause is in the code: `retiredContent` (`packages/core/src/plane/write.ts`) reads and parses every projected item, of every scope, on every write including a denial, `enforceBudget` reads the projection again on an allowed write, and a read calls `currentItems` twice. Writing a store item by item is therefore quadratic: 664 s for 10,000 items.

**Consequence.** A backlog row; no change before the `prereg-v1` tag.
