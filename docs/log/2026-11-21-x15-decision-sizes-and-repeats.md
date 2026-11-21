---
date: 2026-11-21
author: claude-agent
type: decision
card: X15
chapter: evaluation
pillar: plane
hypothesis: H2
evidence:
  - research/configs/perf-budget.json
  - research/results/h2-perf-budget.json
supersedes: none
---

**What.** The suite measures 100, 1,000 and 10,000 items on the fake and 100 and 1,000 on the files adapter, with 200, 50 and 30 timed calls per cell after 10 untimed ones; 100,000 items is not measured.

**Why.** The card asks for 100,000 items if it finishes. Writing the store goes through Plane.write, which is linear in the store, so population is quadratic: 664 s at 10,000 on the fake, an estimated 18 hours at 100,000. Repeats fall with size so the suite runs in about 24 minutes; strict's person-scope budget of 500 also caps the timed writes into one scope.

**Result.** p99.9 is never a resolved tail (no cell has 1,000 calls), and at 1,000 and 10,000 items neither is p99; the result's notes say so.

**Consequence.** A larger size needs the linear scans fixed first, or a population path that is not a plane write per item.
