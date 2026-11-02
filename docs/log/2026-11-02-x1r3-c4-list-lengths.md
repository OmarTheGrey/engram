---
date: 2026-11-02
author: claude-agent
type: finding
card: X1
chapter: results
pillar: research
hypothesis: H1
evidence:
  - packages/runner/scripts/c4-walk-lengths.ts
  - "node packages/runner/scripts/c4-walk-lengths.ts fixtures/bench/gatemem"
  - "node packages/runner/scripts/c4-walk-lengths.ts .engram/upstream/gatemem/bench/data"
supersedes: none
---

**What.** Under the walk, C4 shows more items than the read limit on most GateMem checkpoints.

**Why.** Review round 3 (V-2) asked for C4's list length distribution on the fixture.

**Result.** Fixture, each checkpoint's own question: C4 shows 1 to 180 items, quartiles 25, 42 and 73, mean 54.9; 2 checkpoints under 20, 1 at 20, 6 at 21 to 40, 7 at 41 to 80, 3 at 81 to 160, 1 above. Pinned full set: 0 to 222, quartiles 26, 52 and 103, more than 20 on 2,026 of 2,218; 151,144 items against C2's 44,051. Allowed items equal C5's 10,434 (utility), 8,290 (access control) and 12,809 (forgetting).

**Consequence.** C4 sessions cost about 3.4 times C2's memory tokens; ADR 0031 records it for the cost estimate.
