---
date: 2026-11-19
author: claude-agent
type: failure
card: RV2
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/log/2026-11-19-rv2-decision-fault-set-commit.md
  - research/results/MANIFEST.md
supersedes: none
---

**What.** Review finding RV2-2: I moved h3-fault-set's cell because a later commit changed the code it runs, but I checked only the four rows RV-EXP-9 named. h1-cost's entry code changed at `c89bdf8`, and the plane rows run the core that `f1f07f4` rewrote, while their cells still read `2c503aa`.

**Why.** I applied the rule by hand to the rows in front of me, not to the whole MANIFEST.

**Result.** The rule is now made mechanical and applied to all twelve rows (`docs/log/2026-11-19-rv2-review-decision-commit-rule.md`). Three more cells move.

**Consequence.** Every cell follows one stated rule.
