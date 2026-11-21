---
id: repo-tinybench
title: tinybench (and mitata), micro-benchmark libraries for JavaScript
authors: tinylibs contributors (tinybench); evanwashere (mitata)
venue: GitHub repository, active 2026
year: 2026
tier: new
topics: [performance, benchmark, tooling, latency]
engram: [plane]
code: https://github.com/tinylibs/tinybench
sources_read: [https://github.com/tinylibs/tinybench, https://api.github.com/repos/tinylibs/tinybench, https://api.github.com/repos/evanwashere/mitata]
---

## Claim
A small, dependency-light benchmark harness gives per-operation latency and throughput with dispersion statistics, which is what a published latency budget for the plane needs. It is the layer under Vitest's bench mode.

## Method
Tinybench runs a task function repeatedly for a time or iteration budget, detects async tasks, supports abort signals, and reports average, median, standard deviation, margin of error, MAD and sample count. It uses `process.hrtime` or `performance.now` through Web APIs, so it runs on Node, Bun and Deno. Mitata is the alternative: also MIT, but its last push was 2025-02-17, so it is stale next to tinybench.

## Key numbers
- tinybench: MIT, 2,385 stars, last push 2026-11-21 (GitHub API, checked 2026-11-21), TypeScript.
- mitata: MIT, 2,546 stars, last push 2025-02-17 (GitHub API), JavaScript.
- Whether tinybench exposes p99 directly: not confirmed from the README. The page names "percentiles" generally; retaining raw samples (an option the README describes) lets us compute p50 and p99 ourselves.

## What Engram borrows
A `packages/bench/perf` suite (report plan AB-PRF-1) that times `Plane.write` and `Plane.read` per policy preset and store size, keeps raw samples, and computes p50, p99 and p99.9 itself with the bootstrap code already in research/ (ADR 0016).

## What Engram does differently
Absolute wall-clock numbers are machine-dependent, so Engram's budget gates on deterministic counters (SQL statements and JSON parses per call) and on ratios to a bare-SQLite baseline, and publishes wall-clock as an informative table.

## Risk to our claims
A latency claim from a single developer laptop is weak evidence. Mitigation: report machine, Node version and seed, run each cell in a fresh process, and never gate on wall time alone.

## Open question
Does p99 on a 10,000-item projection stay under the budget once the full-projection scan on every read is replaced by a cache?

## Notes
Version pin to be chosen at least two weeks old when added. Dev dependency only.
