---
date: 2026-11-20
author: claude-agent
type: finding
card: RV6
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-cost.json
  - "make run CONFIG=research/configs/h1-gatemem.json COUNT=1"
  - "make run CONFIG=research/configs/x1-h1-gatemem.json"
  - packages/runner/src/shard.ts
supersedes: none
---

**What.** H1's GateMem arm takes about 13 hours to 2 days of wall time on 4 shards, and 7 hours to 1 day on 8, against 2 to 8 days on one process.

**Why.** RV-DES-10: does H1 finish before Gate C?

**Result.** Inputs: 53,232 to 106,464 answer and 26,616 to 79,848 judge calls (`research/results/h1-cost.json`); 3,906,360 Mem0 writes at 18 ms; 53 ms of runner work a session (x1-h1-gatemem replay). Assumed: an answer call 1.5 to 4 s, a judge call 1 to 2.5 s, unchanged at n concurrent requests, a core per shard. Serially, calls take 30 to 174 hours and writes 19.5; shards divide both, writes by the largest block's share (1.133 at 4, 1.222 at 8). Totals: 49.5 to 194 hours (1 shard), 13.0 to 49.1 (4), 6.7 to 24.8 (8). B3's replay measured about 3 ms a Mem0 write.

**Consequence.** Four shards fit 1 to 8 December.
