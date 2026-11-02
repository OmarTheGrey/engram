---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/analysis/bootstrap.py
  - docs/readings/litreview/methods-efron-tibshirani-bootstrap.md
supersedes: none
---

**What.** BCa's bias correction z0 counts resamples tying the observed mean as half below, as scipy's reference implementation does, rather than Efron and Tibshirani's strict count.

**Why.** The bootstrap distribution of a mean of 0/1 outcomes over a few hundred items is a lattice, and a few percent of resamples land exactly on the observed mean; the strict count pushes z0 down by that share and shifts both endpoints.

**Result.** z0 = Phi^-1((below + ties / 2) / B). With no ties both rules agree, and `test_analysis.py` matches scipy's endpoints to 1e-12 on a continuous sample. Cost if wrong: endpoints move by a fraction of a lattice step.

**Consequence.** None for the pre-registration's wording, which names BCa.
