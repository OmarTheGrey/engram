---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - docs/conventions/testing.md
  - research/analysis/equivalence.py
  - research/analysis/power.py
supersedes: none
---

**What.** Three texts that called the composite-null search exact are reworded in place: layer 8 of `docs/conventions/testing.md`, the module docstring of `research/analysis/equivalence.py`, and the first line of `_composite_sup`'s docstring in `research/analysis/power.py`.

**Why.** PR #26's final verification, P2v4-2 (failure entry `2026-11-03-pr4a-failure-p2v4-2-supremum-wording`); these are not log entries, so they are corrected, not superseded.

**Result.** Before: "its exact level over the composite null"; "computes, exactly, the largest level found over every null distribution the three-seed design allows"; "The largest level found over every null distribution the three-seed design allows". After: the largest level a search of the boundary |mean| = margin found, each visited level exact, the interior not searched or argued, items assumed independent and identically distributed; the convention and `equivalence.py` also name the Holm-threshold record. No code changed.

**Consequence.** None for any result; docstrings do not reach the bytes.
