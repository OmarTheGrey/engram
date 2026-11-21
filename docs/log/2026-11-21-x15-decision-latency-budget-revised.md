---
date: 2026-11-21
author: claude-agent
type: decision
card: X15
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/architecture.md
  - research/configs/perf-budget.json
  - research/results/h2-perf-budget.json
supersedes: docs/log/2026-11-21-x15-decision-latency-budget.md
---

**What.** The proposed budget keeps its four lines (fake adapter, preset medium, p99 within 50 ms at 1,000 items and within 100 ms at 10,000, for a read and an allowed write), and the architecture table now records the second rule both 10,000-item lines carry: at most 100 times bare node:sqlite's p99.

**Why.** Review finding X15-6: the write's ratio rule was in the config but not in the table. The numbers come from the remeasured run.

**Result.** Met: the write at 1,000 items (14.4 ms). Not met: the read at 1,000 (63.4 ms, a tail of 50 samples with a 15.4 ms median), the read at 10,000 (203.4 ms, 119 times the baseline) and the write at 10,000 (163.3 ms, 41 times, inside its ratio).

**Consequence.** The lead accepts or changes the numbers; the misses wait for the backlog rows.
