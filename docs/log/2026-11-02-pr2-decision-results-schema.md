---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_analysis.py
supersedes: none
---

**What.** H1's results file is JSON Lines, one object per session, schema `h1-sessions/1`: benchmark, model, store, preset, condition, item, seed and violation (true, false or null), every field required and no other allowed.

**Why.** The plan asks the H1 table module to define and document the results file it reads. One row per session keeps the seed visible, so the analysis, not the runner, averages seeds within items, and one flat schema covers both arms.

**Result.** `read_sessions` refuses an unknown or missing field, an unknown benchmark or condition, a non-integer seed and a repeated (benchmark, model, store, condition, item, seed). Cost if wrong: the runner's results rows (PR 3) need a small converter to this shape, written with the first real run.

**Consequence.** The converter from runner rows is left to the PR that runs H1.
