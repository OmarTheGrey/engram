---
date: 2026-11-21
author: claude-agent
type: measurement
card: X15
chapter: results
pillar: plane
hypothesis: none
evidence:
  - research/results/h2-perf-budget.json
  - research/results/h2-perf-budget-samples.jsonl
  - research/configs/perf-budget.json
  - research/results/MANIFEST.md
  - "make perf-budget"
supersedes: docs/log/2026-11-21-x15-measurement-plane-overhead.md
---

**What.** Card X15's suite was rerun with every cell on its own copy of the populated store, on the same i9-14900HX (Node 24.14.0), while CPU load averaged 51 percent (0 to 100) with 30 to 75 node processes.

**Why.** Review finding X15-1 invalidated the first run's preset comparison.

**Result.** From the MANIFEST row's result, medium on the fake: a write's p50 is 4.9, 9.7 and 124.3 ms at 100, 1,000 and 10,000 items, a read's 5.0, 15.4 and 171.4 ms, against a bare insert near 2.7 ms. Medium's p99 at 1,000 items is 63.4 ms for a read (outside the proposed 50 ms; between the two largest of 50 samples) and 14.4 ms for a write; at 10,000 items 203.4 and 163.3 ms, outside 100 ms. Presets' medians differ by at most 2.1 times on identical stores.

**Consequence.** The budget's figures and the architecture paragraph are updated.
