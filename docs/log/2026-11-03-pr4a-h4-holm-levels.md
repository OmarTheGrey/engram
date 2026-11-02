---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/scripts/h4_holm_levels.py
  - research/configs/h4-holm-levels.json
  - research/tests/test_h4_holm_levels.py
supersedes: none
---

**What.** A research script records, for every distinct size `research/results/h4-power.json` commits at alpha 0.01, the largest TOST level the composite-null search found at each Holm threshold 0.05 / k, k = 1 to 5; a fast test holds the record to the committed table.

**Why.** PR #26's final verification, P2v4-1: the table checked only 0.05 and 0.01.

**Result.** The script runs the power script's own `composite_sup` over 26 sizes and 5 thresholds in parallel, and records the power table's sha256. `research/tests/test_h4_holm_levels.py` checks the thresholds, that the record names exactly the committed sizes of the current table (by sha256; 26 sizes), and that every level is at most its threshold; it reads the two results only, so `make test` stays fast and `make test-repro` reruns the search. It failed before the record existed.

**Consequence.** If a size failed, `h4_power.py`'s gate would have to drop it; see the measurement entry.
