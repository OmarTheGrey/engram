---
date: 2026-11-21
author: claude-agent
type: decision
card: X15
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - research/configs/perf-budget.json
  - research/results/h2-perf-budget.json
supersedes: docs/log/2026-11-21-x15-decision-sizes-and-repeats.md
---

**What.** The suite measures 100, 1,000 and 10,000 items on the fake and 100 and 1,000 on the files adapter, with 200, 50 and 30 timed calls per cell after 10 untimed ones; 100,000 items is not measured.

**Why.** The card lists 100,000 items; the brief allowed stopping at 10,000 when 100,000 is too slow. Writing the store goes through Plane.write, which is linear in the store, so population is quadratic: 578 s at 10,000 on the fake, about 16 hours at 100,000 by the same growth. Repeats fall with size to keep the suite near 16 minutes. Each cell writes at most 211 items into one person scope, under strict's budget of 500.

**Result.** No cell resolves p99.9, and at 1,000 items and above no cell resolves p99; the notes say so.

**Consequence.** A larger size needs the scans fixed first.
