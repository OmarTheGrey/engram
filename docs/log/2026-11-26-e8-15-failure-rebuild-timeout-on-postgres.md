---
date: 2026-11-26
author: claude-agent
type: failure
card: E8.15e
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/replay/rebuild.test.ts
supersedes: none
---

**What.** The third pre-merge `make test` of `cliupgrade`, at `e83e2dda`, failed 1 of 6,739 tests: core's property test "rebuild equals incremental for any event sequence". On the embedded Postgres backend it ran 37 seconds and timed out. The first full run, at `458b3519`, failed the same test the same way.

**Why.** The branch changes nothing under `packages/core`. Run alone, the file passes: in under a second on SQLite, and in 9.7 seconds on embedded Postgres with its 500 runs. Under the full suite's load the Postgres runs take about four times as long.

**Result.** No code change on this branch. The test passes alone on both backends, and every other test of the run passed.

**Consequence.** A load-sensitive timeout in core's Postgres replay test is a finding for a core card after the H1 runs, so no core file moves before `prereg-v1`. It is not a TUI defect.
