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
supersedes: docs/log/2026-11-02-pr2-r2-measurement-h4-power.md
---

**What.** Items per arm for H4 with the score TOST, at alpha 0.05 and 0.01: 48 cells, per-family power 0.8, 0.894 and 0.946, every level checked exactly.

**Why.** Review findings R2-1 and R2-2 withdrew the round-two table at alpha 0.01.

**Result.** At alpha 0.05, unchanged: one family 381 to 12,177 items at 2 points, 113 to 1,810 at 5, 48 to 453 at 10; four families 453 to 17,222, 135 to 2,560, 57 to 640. At alpha 0.01, one family 2,560 to 17,222, 761 to 2,560, 320 to 640; four 2,560 to 20,480, 761 to 3,620, 320 to 905. Largest composite-null level at a reported size: 0.047029 (alpha 0.05), 0.009969 (0.01); largest own level 0.04289, 0.008271. The composite null set 103 of 144 sizes at 0.01, none at 0.05. 12 minutes on 32 cores.

**Consequence.** Read with the finding of the same name.
