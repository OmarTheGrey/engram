---
date: 2026-11-20
author: claude-agent
type: failure
card: X4
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/h1_figure.py
  - research/tests/test_h1_figure.py
supersedes: none
---

**What.** Review finding X4-6 on PR #57: at a rate of exactly zero the rate label's baseline sat on the x-axis line.

**Why.** Every label was drawn 4 px below the point's centre, whatever its height.

**Result.** A point within 8 px of the axis takes its label 8 px above it; a test checks the zero rate's label is above the point and 8 px clear of the axis, and that a rate of 0.3 keeps its label beside the point.

**Consequence.** Cosmetic; no number changes.
