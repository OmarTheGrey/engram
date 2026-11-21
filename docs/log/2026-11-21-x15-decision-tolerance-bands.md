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
  - research/scripts/perf_budget.py
  - research/tests/test_perf_budget.py
  - "make perf-budget CHECK=1"
supersedes: docs/log/2026-11-21-x15-decision-tolerance-band.md
---

**What.** The rerun check now has three bands: each plane cell's median within a factor of 3, each bare node:sqlite cell's within 4, and per op the geometric mean of its 15 plane cells' median ratios within 1.5.

**Why.** Review finding X15-3: a factor of 4 per cell could not catch a 2x regression. The bands come from real rerun noise: a second full run after the committed one, nothing changed, moved plane medians by at most 2.18 times, bare ones by 3.12 (a 0.018 ms select) and each op's geometric mean by at most 1.13.

**Result.** A test with every read cell twice as slow fails on the aggregate band and passes every per-cell band; one cell at 3.2 times fails the per-cell band only.

**Consequence.** A regression of an op by half or more fails the check; one cell must triple to fail alone.
