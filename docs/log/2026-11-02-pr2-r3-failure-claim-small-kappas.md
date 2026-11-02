---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - docs/log/2026-11-02-pr2-r2-finding-h4-power.md
  - research/results/h4-power.json
supersedes: none
---

**What.** Review finding R2-7: the round-two finding said the largest measured level, 0.043, was measured at small kappas.

**Why.** It was measured at the cell's own kappa, 0.25; the sentence summarised the gate's kappa grid without reading where the maximum fell.

**Result.** Superseded by `pr2-r3-finding-h4-power`, whose levels come from the table's own fields, the largest own level with the kappa it occurs at (`own_max_at`).

**Consequence.** None.
