---
date: 2026-11-19
author: claude-agent
type: failure
card: RV2
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/scripts/h4_holm_levels.py
  - "timeout 900 uv run python research/scripts/h4_holm_levels.py ...: concurrent.futures.process.BrokenProcessPool after real 15m0.584s"
supersedes: none
---

**What.** My rerun of the h4-holm-levels row failed twice, the first time under the coverage driver and the second when run directly.

**Why.** Both runs sat under a `timeout` I set (300 s, then 900 s). The timeout killed the worker pool mid-run, and the script reported `BrokenProcessPool`. The script was not at fault: the H4 rows take longer than fifteen minutes on this loaded machine, which is why the review counted them among the costly rows.

**Result.** The H4 rows' cells are settled from git history instead. Nothing in their scripts, configs, `research/analysis`, `results_io.py`, `pyproject.toml` or `uv.lock` changed after `9a0d185`.

**Consequence.** Their hashes were not re-verified in this pass. `make test-repro` remains the check.
