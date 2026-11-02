---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/analysis/equivalence.py
  - research/tests/test_equivalence.py
  - research/configs/h4-power.json
supersedes: none
---

**What.** H4's primary p-value is the TOST's p = min(1, 2 max(p_lower, p_upper)), equivalence at level a holding exactly when p < a, and the power table reports sizes at alpha 0.05 and 0.01.

**Why.** Holm needs every primary p-value on one scale (review finding V3). Since each side is held to a / 2, twice the larger one-sided p-value is the smallest level at which the TOST declares equivalence. Holm over five hypotheses tests the smallest p-value at 0.01.

**Result.** Cost if wrong: none for the decision; a reader comparing with a textbook TOST must note the factor two.

**Consequence.** PR 4 recommends H4's size knowing where Holm may put it.
