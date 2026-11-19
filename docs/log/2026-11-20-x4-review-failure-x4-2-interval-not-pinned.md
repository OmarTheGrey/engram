---
date: 2026-11-20
author: claude-agent
type: failure
card: X4
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/effects.py
  - research/tests/test_effects.py
supersedes: none
---

**What.** Review finding X4-2 on PR #57: no test pinned the relative reduction's interval, and two mutants survived all 71 tests (each ratio over the observed C4 rate, and a 90 percent tail).

**Why.** The tests checked that the interval contained the planted value and the point, which a wrong interval also does.

**Result.** A parametrised test, at 95 and 90 percent, compares both endpoints with a direct item-index bootstrap of 200,000 resamples, within 0.01. Both mutants now fail it (2 of 11 tests each).

**Consequence.** The effect block's interval is pinned to the textbook bootstrap.
