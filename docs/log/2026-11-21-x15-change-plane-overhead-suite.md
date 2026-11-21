---
date: 2026-11-21
author: claude-agent
type: change
card: X15
chapter: implementation
pillar: plane
hypothesis: H2
evidence:
  - packages/core/bench/plane-overhead.ts
  - packages/core/bench/workload.ts
  - packages/core/bench/count.ts
  - packages/core/test/bench/count.test.ts
  - "make test-one T=packages/core/test/bench/count.test.ts"
supersedes: none
---

**What.** Card X15 adds the plane-overhead suite in `packages/core/bench/`: tinybench 6.2.3 times Plane.write (allowed), a denied write and Plane.read on the fake and files adapters per store size and preset, beside a bare node:sqlite insert and select, and writes every raw sample to a JSONL file.

**Why.** The governance tax in time had never been measured.

**Result.** `countingDb` wraps `Db.prepare` and counts prepares, statement executions, execs and transactions. The timed plane's Db is not wrapped: a second plane over the same log takes the counts from one untimed call per cell. The test asserts the counts exactly on the fake under every preset: 16 statements in 3 transactions per allowed write, 6 in 1 per denied write, 16 in 2 per read (15 under strict), the same at 100 and 400 items. Nothing under any package's `src/` changed.

**Consequence.** `make perf-budget` reruns it; the samples feed `research/scripts/perf_budget.py`.
