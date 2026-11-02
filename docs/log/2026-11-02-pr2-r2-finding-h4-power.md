---
date: 2026-11-02
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-power.json
  - research/analysis/equivalence.py
  - docs/research/preregistration.md
supersedes: docs/log/2026-11-02-pr2-review-finding-h4-power.md
---

**What.** With a TOST whose level at the reported sizes is at most 0.026 exactly at kappa 0 and 0.043 measured at small kappas (alpha 0.05), about 100 items per arm powers no grid cell at 2 or 5 points.

**Why.** H4 needs four families to pass; Holm may test it at 0.01.

**Result.** At 10 points, 100 items per arm suffice in 9 of 16 cells (one family) and 7 (four) at alpha 0.05, 3 and 1 at 0.01. At a 0.05 rate, four families need 67 to 190 items per arm at 10 points (135 to 269 at alpha 0.01) and 190 to 761 at 5 points (320 to 1,076); at 0.01 the level gate set 46 sizes (`research/results/h4-power.json`).

**Consequence.** Undecided, for PR 4: 10 points with a few hundred items per arm, or 5 points with up to 1,076.
