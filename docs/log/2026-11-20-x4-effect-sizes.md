---
date: 2026-11-20
author: claude-agent
type: decision
card: X4
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/analysis/effects.py
  - research/tests/test_effects.py
  - docs/research/preregistration.md
supersedes: none
---

**What.** Proposed for the lead: H1 reports two effect sizes per contrast, the absolute difference in violation rate (C4 minus C5, the contrast's paired mean with its BCa interval) and the relative reduction, (rate C4 minus rate C5) over rate C4, with a 95 percent percentile interval.

**Why.** Card X4 asks for effect sizes. v1's Statistics section names the test and its interval but no effect size, and v1 stays as it is.

**Result.** The difference was already in the table. The relative reduction is new: both rates over the pairs the contrast keeps, so their difference equals its mean; a seeded paired bootstrap of 10,000 resamples; null when C4's rate is zero, and resamples where it is zero counted and left out. Marked `"registered": false`. Cost if wrong: one key of the table; no decision reads it.

**Consequence.** The lead registers, changes or drops it by amendment.
