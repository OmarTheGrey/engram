---
date: 2026-11-28
author: claude-agent
type: measurement
card: none
chapter: results
pillar: plane
hypothesis: none
evidence:
  - research/results/h2-perf-budget.json
  - research/configs/perf-budget.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/perf_budget.py --config research/configs/perf-budget.json --out research/results/h2-perf-budget.json"
supersedes: docs/log/2026-11-21-x15-measurement-fresh-stores.md
---

**What.** Card X15's engineering measurement of the plane's latency, restated citing only the MANIFEST result.

**Why.** The superseded entry cited the raw samples file, research/results/h2-perf-budget-samples.jsonl, which is not a MANIFEST row, so the thesis consolidator rejects it; the script computes the result from those committed samples.

**Result.** On the fake store under medium, a read's p99 at 1,000 items is 63.418061 ms against a 50 ms limit (`budget[0]`, not met) and a write's 14.445315 ms (`budget[1]`, met); at 10,000 items 203.405203 and 163.290634 ms against 100 ms (`budget[2]`, `budget[3]`, not met). Medians at 100, 1,000 and 10,000 items: write 4.8773, 9.6757 and 124.34365 ms; read 5.01845, 15.3816 and 171.4389 ms (`cells`), on the machine `machine` names, under the shared load the superseded entry records. It decides no hypothesis.

**Consequence.** Nothing changes; the numbers match the superseded entry's.
