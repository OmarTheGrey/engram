---
date: 2026-11-03
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
supersedes: docs/log/2026-11-02-pr2-r3-measurement-h4-power.md
---

**What.** Items per arm for H4 with the score TOST at alpha 0.05 and 0.01, restated without calling a search result exact; the file is unchanged.

**Why.** PR #26's final verification, P2v4-2: the superseded entry said "Largest composite-null level".

**Result.** Sizes as before: at alpha 0.05, one family 381 to 12,177 items at 2 points, 113 to 1,810 at 5, 48 to 453 at 10; four families 453 to 17,222, 135 to 2,560, 57 to 640. At alpha 0.01, one family 2,560 to 17,222, 761 to 2,560, 320 to 640; four 2,560 to 20,480, 761 to 3,620, 320 to 905. The largest level a search of the composite null's boundary (|mean| = margin, iid items) found at a reported size: 0.047029 (alpha 0.05; 80 items, 10 points) and 0.009969 (0.01; 761 items, 5 points). Largest own level: 0.04289 and 0.008271.

**Consequence.** Read with `2026-11-03-pr4a-finding-h4-power`.
