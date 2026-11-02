---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - docs/log/2026-11-02-pr2-review-decision-power-model.md
  - research/results/h4-power.json
supersedes: none
---

**What.** Review finding R2-6: the round-one power-model decision said the size scales linearly in kappa.

**Why.** It does not: the TOST's variance adds the margin squared and is floored at margin (1 - margin), neither of which scales with kappa. From kappa 0.25 to kappa 1 the size grows 1.40 to 4.00 times at alpha 0.05 in round two's table.

**Result.** Superseded by `pr2-r3-decision-power-model`, which states the ratios from the regenerated table.

**Consequence.** None.
