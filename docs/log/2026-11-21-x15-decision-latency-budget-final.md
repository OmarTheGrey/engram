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
supersedes: docs/log/2026-11-21-x15-decision-latency-budget-revised.md
---

**What.** The proposed latency budget stays as it is: on the fake under preset medium, p99 within 50 ms at 1,000 items and within 100 ms at 10,000 for a read and an allowed write, both 10,000-item lines also within 100 times bare node:sqlite's p99.

**Why.** The coordinator decided not to change the limits after the remeasured read at 1,000 items missed. The miss is stated, not explained away.

**Result.** The read at 1,000 items measures 63.4 ms at p99 against 50 ms, a tail of 50 samples: with n below 100 the p99 lies between the two largest samples and is not resolved; the median is 15.4 ms. The write at 1,000 items is met (14.4 ms); both 10,000-item lines miss (203.4 and 163.3 ms). `docs/architecture.md` states each.

**Consequence.** More repeats at 1,000 items would resolve the p99; that is a remeasurement for a later card.
