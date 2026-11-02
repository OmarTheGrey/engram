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
supersedes: docs/log/2026-11-02-pr2-r2-finding-h4-power.md
---

**What.** With the TOST's exact level over the composite null at most alpha at every reported size, about 100 items per arm powers no cell at 2 or 5 points, and none at alpha 0.01.

**Why.** H4 needs four families; Holm may test it at 0.01.

**Result.** At 10 points and alpha 0.05, 100 items per arm suffice in 9 of 16 cells (one family) and 7 (four). At alpha 0.01 no size is below 320, 761 and 2,560 items at 10, 5 and 2 points; 103 sit there, the rung below failing the TOST's level. At a 0.05 rate, four families need 67 to 190 items at 10 points (320 at alpha 0.01) and 190 to 761 at 5 points (761 to 1,076).

**Consequence.** For PR 4: 10 points with a few hundred items per arm, 5 points with up to 1,076, or a calibrated critical value at 0.01.
