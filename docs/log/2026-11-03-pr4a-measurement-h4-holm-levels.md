---
date: 2026-11-03
author: claude-agent
type: measurement
card: R1
chapter: results
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-holm-levels.json
  - research/configs/h4-holm-levels.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h4_holm_levels.py --config research/configs/h4-holm-levels.json --out research/results/h4-holm-levels.json"
supersedes: none
---

**What.** For each of the 26 distinct sizes `research/results/h4-power.json` commits at alpha 0.01, the largest TOST level a search of the composite null's boundary found at each Holm threshold 0.05 / k, k = 1 to 5 (MANIFEST sha256 `dcacf0c9...`).

**Why.** PR #26's final verification, P2v4-1.

**Result.** Every size holds at every threshold (`all_hold`: true), the 2-point sizes from 7,241 to 20,480 items included. The tightest is 761 items at 5 points: 0.009969 against 0.01 (k = 5), 0.012202 against 0.0125 (k = 4), 0.014817 against 0.016667, 0.020599 against 0.025, 0.036113 against 0.05. The verifier's 0.012202 at 761 items is reproduced. At k = 5 every level equals the power table's own record at 0.01.

**Consequence.** No size is dropped; `research/scripts/h4_power.py` and its result stay as they are.
