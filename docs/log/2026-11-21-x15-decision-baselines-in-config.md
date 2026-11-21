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
supersedes: docs/log/2026-11-21-x15-decision-baseline.md
---

**What.** Which bare node:sqlite cell each plane op is compared with, the machine fields a rerun must match, and the percentiles the overhead table reports now come from the config (review finding X15-5). The rerun also refuses another Node or tinybench version.

**Why.** They were constants in the script. A denied write is compared with the bare single-row insert on purpose: a denial records exactly one row, its event, appended and committed in one transaction, so the ratio is what the gate adds to writing that one row durably. A bare select would leave out the commit's fsync that a denial pays.

**Result.** Tests cover a config without p99 (no `p99_ratio` anywhere), a baseline changed in the config, and a Node version refused.

**Consequence.** Another comparison is a config edit, recorded with its reason under `baseline_of`.
