---
date: 2026-11-03
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-c4-walk.json
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
supersedes: docs/log/2026-11-02-x1r3-c4-list-lengths.md
---

**What.** The walk moved GateMem's retrieval difference from C4 against C5 to C3 against C4.

**Why.** Before the walk, C4's allowed items fell short of C5's list on 2,026 checkpoints; N-1 asked what fixing that costs elsewhere. The superseded entry used a development script.

**Result.** C3 and C4 show lists of different length on 2,179 of 2,218 checkpoints; C4 shows fewer items on 153 and none on 28, where the plane admits no candidate and C3 still shows up to 20 denied ones; on 54 access-control checkpoints C3 shows a denied leak-target item C4 hides, on 365 C4 shows one C3 never reaches (`research/results/h1-c4-walk.json`). Lengths match the superseded entry: median 52, 0 to 222, 151,144 items against 44,051.

**Consequence.** No H1 contrast compares C3 with C4; ADR 0031 (still proposed) says so, and a reader of C3 against C4 takes metadata and list together.
