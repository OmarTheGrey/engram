---
date: 2026-11-21
author: claude-agent
type: milestone
card: X15
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - research/results/h2-perf-budget-samples.jsonl
  - research/configs/perf-budget.json
  - research/results/MANIFEST.md
  - "make perf-budget CHECK=1"
supersedes: none
---

**What.** Card X15's acceptance after the one-sided aggregate band: the MANIFEST row of `research/results/h2-perf-budget.json` reproduces (`reproduce.check_row`: no problems), and one `make perf-budget CHECK=1` against the committed samples, not remeasured, passed.

**Why.** The coordinator asked for one rerun under the decided bands, its outcome reported whichever way it went.

**Result.** "rerun check passed": all 51 cells inside their two-sided bands (the largest move 2.54 times, faster, the fake's permissive read at 1,000 items), every query count and starting log equal, and the geometric means of median ratios 0.625 (reads), 0.749 (writes) and 0.779 (denied writes), all at most 1.5. The rerun was faster than the committed run again: 14 minutes, CPU load near 54 percent, 27 to 41 node processes.

**Consequence.** The card's acceptance passes; the earlier failure entry stands as the record of the two-sided band.
