---
date: 2026-11-02
author: claude-agent
type: measurement
card: R1
chapter: results
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-power.json
  - research/configs/h4-power.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h4_power.py --config research/configs/h4-power.json --out research/results/h4-power.json"
supersedes: docs/log/2026-11-02-pr2-review-measurement-h4-power.md
---

**What.** Items per arm for H4 with the score TOST, at alpha 0.05 and 0.01: 48 cells, per-family power 0.8, 0.894 and 0.946, every size's level checked.

**Why.** Review findings V1 to V3 withdrew the round-one table.

**Result.** One family at alpha 0.05: 381 to 12,177 items at 2 points, 113 to 1,810 at 5, 48 to 453 at 10; four families: 453 to 17,222, 135 to 2,560, 57 to 640. At alpha 0.01, one family: 538 to 17,222, 190 to 2,560, 80 to 640; four: 1,076 to 20,480, 190 to 3,620, 95 to 905. Levels at the reported sizes: exact at kappa 0 at most 0.0255 (0.0046 at alpha 0.01); measured at most 0.0433 (0.0086) against gates of 0.0469 (0.0086). The gate set 46 of 144 sizes at 0.01, none at 0.05.

**Consequence.** Read with the finding of the same name.
