---
date: 2026-11-21
author: claude-agent
type: failure
card: X15
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - research/configs/perf-budget.json
  - research/results/h2-perf-budget-samples.jsonl
  - research/results/MANIFEST.md
  - "make perf-budget CHECK=1"
supersedes: docs/log/2026-11-21-x15-milestone-rerun-check.md
---

**What.** After the review fix pass was committed, the MANIFEST row of `research/results/h2-perf-budget.json` reproduced (`reproduce.check_row`: no problems), but the final `make perf-budget CHECK=1` failed.

**Why.** The aggregate band is two-sided and was set from one noise run. This rerun ran faster than the committed one (11 minutes, not 16; about 34 node processes on average, not 41).

**Result.** Every per-cell median stayed inside its band (the largest move was 2.37 times, the fake's permissive read at 1,000 items) and every query count and starting log size was equal. The read's geometric mean of median ratios was 0.644, outside 1/1.5 to 1.5; writes 0.790, denied writes 0.841. The noise run had given at most 1.13.

**Consequence.** The bands were not widened after seeing this. The lead or the next pass chooses among: a one-sided aggregate (a regression guard), ratios to the same run's bare baseline, or bands from several noise runs.
