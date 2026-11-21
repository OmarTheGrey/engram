---
id: repo-bencher
title: Bencher, continuous benchmarking with regression thresholds
authors: Bencher contributors
venue: GitHub repository, active 2026
year: 2026
tier: new
topics: [performance, benchmark, regression, tooling]
engram: [plane]
code: https://github.com/bencherdev/bencher
sources_read: [https://github.com/bencherdev/bencher, https://api.github.com/repos/bencherdev/bencher]
---

## Claim
A benchmark tracker that stores results over time and fails a run on a threshold, with a self-hosted option. It supports Vitest and Benchmark.js output and console.time, but the README does not name tinybench.

## Method
`bencher run` wraps a benchmark command, parses its output with an adapter, compares against thresholds and can exit non-zero with `--error-on-alert` or comment on a PR. The README says most content is Apache-2.0 or MIT at your choice, with directories named "plus" under a separate Bencher Plus licence. The GitHub API reports NOASSERTION.

## Key numbers
- 933 stars, last push 2026-11-21, Rust (GitHub API, checked 2026-11-21).
- Which statistical test it uses: not stated in the page read.
- Whether Bencher Cloud is free for open source: not stated in the page read.

## What Engram borrows
Ideas, not a dependency: a committed `research/results/perf-budget.json` and a script that compares a run to it, in the style of the repository's other results (rule 9).

## What Engram does differently
CI is nonfunctional for this project (merge on local make gates), and no external service may hold dogfood data, so the comparison is a local script, not a hosted tracker.

## Risk to our claims
Adopting a hosted tracker adds an external service and a licence question (Plus directories) for little gain.

## Open question
Is a ratio-to-baseline plus counter budget enough to catch a 2x regression without a tracker?

## Notes
Self-hosting runs on bare metal, Docker or Kubernetes; Docker is out of bounds here.
