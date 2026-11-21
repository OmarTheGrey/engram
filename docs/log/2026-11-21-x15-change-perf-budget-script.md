---
date: 2026-11-21
author: claude-agent
type: change
card: X15
chapter: implementation
pillar: plane
hypothesis: H2
evidence:
  - research/scripts/perf_budget.py
  - research/configs/perf-budget.json
  - research/tests/test_perf_budget.py
  - "uv run pytest -q research/tests/test_perf_budget.py"
supersedes: none
---

**What.** Card X15 adds `research/scripts/perf_budget.py`, its config `research/configs/perf-budget.json`, the `make perf-budget` target, and the rerun check (`make perf-budget CHECK=1`).

**Why.** Timings are not byte-stable, so rule 9 needs the measurement and the result split: the suite's raw samples are committed, and the result is computed from them, byte for byte under `make test-repro`.

**Result.** The script refuses samples taken with another suite block than the config's, and computes per cell n, mean, min, max and the p50, p99 and p99.9 (linear interpolation, numpy's default), the ratio of each plane cell to the baseline at its size, the population time, and each budget rule. `--rerun` reruns the suite into a temporary file and passes when every median lies within the config's band and every query count is equal; it refuses another machine's samples. Ten pytest cases cover it.

**Consequence.** The MANIFEST row reruns the result from the committed samples.
