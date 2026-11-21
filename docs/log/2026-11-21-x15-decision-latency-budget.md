---
date: 2026-11-21
author: claude-agent
type: decision
card: X15
chapter: design
pillar: plane
hypothesis: H2
evidence:
  - docs/architecture.md
  - research/configs/perf-budget.json
  - research/results/h2-perf-budget.json
supersedes: none
---

**What.** Card X15 proposes a latency budget in `docs/architecture.md`: on the fake under preset medium, Plane.read and an allowed Plane.write within 50 ms at p99 at 1,000 items and within 100 ms at 10,000 items, the read also within 100 times bare node:sqlite's p99.

**Why.** The card asks for a budget proposed from the measurement, in graphCTX's manner of a published percentile budget tested against. The fake isolates the plane's own cost from a store's. 100 ms keeps a governed call a small share of a model turn of seconds.

**Result.** Met at 1,000 items (38.7 and 30.3 ms); not met at 10,000 (361.2 and 310.5 ms), as `research/results/h2-perf-budget.json` records with `met: false`.

**Consequence.** The lead accepts or changes the numbers; the miss at 10,000 waits for the backlog row on the linear scans.
