---
date: 2026-11-03
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-power.json
  - research/results/h4-holm-levels.json
  - research/analysis/equivalence.py
supersedes: docs/log/2026-11-02-pr2-r3-finding-h4-power.md
---

**What.** Where the largest level a search of the composite null's boundary (|mean| = margin, iid items, interior not searched) found is at most alpha at every reported size, and at every Holm threshold for the alpha-0.01 sizes, about 100 items per arm powers no cell at 2 or 5 points, and none at alpha 0.01.

**Why.** The superseded entry called the level exact and quoted none (P2v4-2, P2v4-3).

**Result.** Sizes unchanged: at 10 points and alpha 0.05, 100 items suffice in 9 of 16 cells (one family) and 7 (four); at alpha 0.01 none below 320, 761 and 2,560 items. Largest own level 0.04289 at 381 items, 2 points, rate 0.02, "identical, kappa 0.25" (alpha 0.05); 0.008271 at 761 items, 5 points, rate 0.1, "identical, kappa 0.1" (alpha 0.01), per `own_max_at`.

**Consequence.** As before: 10 points with a few hundred items, or 5 points with up to 1,076.
