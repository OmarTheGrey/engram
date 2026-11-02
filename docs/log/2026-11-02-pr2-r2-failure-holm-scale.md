---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - research/analysis/equivalence.py
  - research/analysis/h1.py
supersedes: none
---

**What.** Review finding V3: H4's input to Holm was undefined.

**Why.** The round-one TOST compared its p-value with alpha / 2, so passing it to `decide_h1` as H4's primary p-value would have tested H4 at twice the level Holm assigned it.

**Result.** The TOST now reports p = min(1, 2 max(p_lower, p_upper)), and equivalence at level a holds exactly when p < a; a test passes H4's p-value through Holm and `decide_h1` and checks the decision against the TOST run at Holm's threshold. The power table gives sizes at alpha 0.01 beside 0.05, since Holm over five may test H4 at 0.01.

**Consequence.** PR 4 can recommend H4's alpha knowing Holm.
