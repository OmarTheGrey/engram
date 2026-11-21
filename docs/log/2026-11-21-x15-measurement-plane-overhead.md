---
date: 2026-11-21
author: claude-agent
type: measurement
card: X15
chapter: results
pillar: plane
hypothesis: H2
evidence:
  - research/results/h2-perf-budget.json
  - research/results/h2-perf-budget-samples.jsonl
  - research/configs/perf-budget.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/perf_budget.py --config research/configs/perf-budget.json --out research/results/h2-perf-budget.json"
supersedes: none
---

**What.** Card X15 measured Plane.write, a denied write and Plane.read on the fake and files adapters at 100, 1,000 and 10,000 items under the three presets, beside bare node:sqlite, once, on an Intel Core i9-14900HX (Node 24.14.0) shared with about ten other agents.

**Why.** The plane's time cost was unmeasured.

**Result.** From the MANIFEST row's result, medium preset on the fake: a write's p50 is 7.1, 18.7 and 223.0 ms at the three sizes, a read's 6.4, 21.8 and 273.4 ms; the bare insert stays near 2.8 ms. Medium's p99 at 1,000 items is 38.7 ms (read) and 30.3 ms (write), inside the proposed 50 ms; at 10,000 items 361.2 and 310.5 ms, outside the proposed 100 ms. Files-adapter reads take 0.25 to 1.5 s. Cells hold 200, 50 and 30 calls.

**Consequence.** The budget is proposed in `docs/architecture.md`; the 10,000-item miss is a backlog row.
