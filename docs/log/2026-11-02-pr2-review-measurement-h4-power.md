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
supersedes: docs/log/2026-11-02-pr2-measurement-h4-power.md
---

**What.** Items per arm for H4's three-arm TOST, recomputed with the TOST that holds its level: 48 cells, per-family power 0.8, 0.894 and 0.946 (one, two and four families jointly at 0.8).

**Why.** Review findings P2-1, P2-6 and P2-7 withdrew the first table.

**Result.** One family: 453 to 12,177 items at a 2-point margin, 160 to 1,810 at 5, 57 to 453 at 10; at a 0.05 rate, 538 to 3,620, 190 to 640 and 95 to 190. Four families: 538 to 17,222, 190 to 2,560 and 80 to 640. Each size's power was confirmed over 1,000 studies (0.81 to 1.00); its level, with one pair on the margin either way, measured at most 0.058 under the cell's kappa and kappa 0 (tolerance 0.064).

**Consequence.** Read with the finding entry of the same name.
