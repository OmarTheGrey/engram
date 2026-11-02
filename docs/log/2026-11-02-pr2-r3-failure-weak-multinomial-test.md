---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - research/tests/test_research_scripts.py
  - research/analysis/power.py
supersedes: none
---

**What.** Review finding R2-8: the test of the multinomial item states against simulating every item used equal rates and kappa 0.5 only, at four standard errors of 1,500 studies, too loose to catch a real error and blind to the unequal-rate path the level uses.

**Why.** It compared power, a joint pass rate that many errors leave nearly unchanged, rather than the states' distribution.

**Result.** New tests: closed-form means, pair second moments and the all-three cell of `item_states` at rates 0.1, 0.2, 0.15 and kappa 0.4, to 1e-12; the seven-point law of a pair's difference against 400,000 simulated items within five standard errors; the simulated level at rates 0.1 and 0.2 against the exact one. A nested cut off by one and kappa drawn once per item instead of per draw both fail them.

**Consequence.** None.
