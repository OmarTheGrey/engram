---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/results/h1-c4-walk.json
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
supersedes: none
---

**What.** Recommended, for the lead's decision: C4 on GateMem walks the shared ranking until it has passed as many allowed items as C5 returns (ADR 0031, decision 4; decision sheet item 4).

**Why.** C4 and C5 then see the same permitted items, so H1's primary test compares mechanisms on equal retrieval.

**Result.** C4 shows 151,144 items against C3's 44,051 (3.43 times), fewer than C3 on 153 checkpoints and none on 28; the retrieval difference moved to C3 against C4, which no H1 contrast compares (`research/results/h1-c4-walk.json`). Without the walk, C4's allowed items fell short of C5's list on 2,026 of 2,218 checkpoints (ADR 0031). Cost: on the 28 checkpoints where the plane admits nothing, C4 shows nothing, as C5 does, which pulls C4 minus C5 toward zero; v1's H1 analysis reports it.

**Consequence.** If changed, a new ADR supersedes 0031 and the fixture suite is recorded again.
