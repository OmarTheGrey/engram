---
date: 2026-11-21
author: claude-agent
type: change
card: X15
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/bench/plane-overhead.ts
  - packages/core/bench/count.ts
  - packages/core/test/bench/count.test.ts
  - research/scripts/perf_budget.py
  - research/tests/test_perf_budget.py
  - Makefile
supersedes: none
---

**What.** Card X15's review fix pass: every cell on its own copy of the store, samples in call order (X15-1, X15-8); rows read counted, the read-history scan pinned by a test, the finding and backlog corrected (X15-2); per-cell and aggregate bands from rerun noise (X15-3); hypothesis `none` (X15-4); baselines, machine keys and percentiles in the config, Node and tinybench checked (X15-5); corrected figures (X15-6); `make perf-budget` remeasures only with `MEASURE=1` (X15-7); the counts test at 2,000 items over two scopes (X15-9).

**Why.** The review found three important defects and six minor ones; the main one needed a rerun.

**Result.** The suite was rerun, the samples and result recommitted, and the MANIFEST row names the branch commit. Probe counts are now taken on a warm handle, which removed the strict read's missing statement.

**Consequence.** The entries this pass corrects are superseded, each by its own entry.
