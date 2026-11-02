---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-power.json
  - research/analysis/power.py
  - research/scripts/h4_power.py
  - research/tests/test_equivalence.py
supersedes: none
---

**What.** Review findings R2-1 and R2-2: the round-two gate let through sizes at which the TOST's level exceeds alpha 0.01.

**Why.** It computed the identical-seed level exactly only at kappa 0 and measured the rest by simulation on a grid of kappas. Nulls whose item differences take several of the seven values a three-seed item allows, with the mean on the margin, were never checked. Over that composite null, 92 of the 144 sizes it reported at alpha 0.01 have an exact level above 0.01, up to 0.0154 (538 items, 2 points).

**Result.** The gate is now the largest exact level found over the composite null (decision `pr2-r3-decision-level-gate`). At alpha 0.05 no reported size moves: the largest level there is 0.047.

**Consequence.** The round-two table at alpha 0.01 is withdrawn.
