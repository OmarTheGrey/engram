---
date: 2026-10-20
author: fixture
type: measurement
card: X1
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/x1-gatemem-2026-10-20.json
  - research/configs/x1-gatemem.yaml
  - "make bench BENCH=gatemem"
supersedes: none
---

**What.** GateMem was run under the enforcement condition on the fixture subset.

**Why.** H1 needs a baseline leak rate.

**Result.** The results file records the leak rate per seed.

**Consequence.** The instruction condition runs next.
