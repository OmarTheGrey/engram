---
date: 2026-11-02
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/analysis/bootstrap.py
  - research/analysis/holm.py
  - research/analysis/wilson.py
  - research/analysis/h1.py
  - research/tests/test_analysis.py
  - "uv run pytest research/tests/test_analysis.py"
supersedes: none
---

**What.** The pre-registration's Statistics section is now code: `research/analysis/`, tested before it sees data.

**Why.** Plan decision 3 of `docs/tasks/prereg-v1-plan.md`: the analysis must be fixed and tested on synthetic data before any run (ADR 0016).

**Result.** A paired bootstrap of the mean difference (10,000 resamples, BCa with the percentile interval, z0 and acceleration beside it, the one-sided p-value as the share of resamples at or below zero), seeds averaged within items, TOST for H4, Holm, Wilson intervals, and `h1.py`, which defines the results-file schema `h1-sessions/1` and builds the H1 table. `test_analysis.py` (40 tests) recovers a planted effect at nominal coverage, holds a planted null's one-sided rejection rate within 0.03 to 0.07 over 1,000 seeded runs, checks Holm by hand, BCa against scipy, and Wilson against Newcombe 1998. numpy 2.5.4 added; scipy 1.18.1 for the reference test only.

**Consequence.** PR 4 and the H1 runs use this code unchanged.
