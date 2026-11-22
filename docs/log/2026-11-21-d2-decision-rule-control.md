---
date: 2026-11-21
author: claude-agent
type: decision
card: D2
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/induce.ts
  - docs/research/preregistration.md
supersedes: none
---

**What.** The control finds the contiguous run of two or more tool calls held by the most examples. Ties go to the longer run, then the first in code-unit order, and at least two examples must share it. It yields one candidate, written with method `rule` in its ref.

**Why.** Card D2 step 4 asks for a control that calls no model. AWM's own rule-based induction (Appendix B, `induce_rule.py`) is the published form. The pre-registration names no rule-based method, so this is not an H5 condition.

**Result.** On the fixture it picks `read read`, shared by 6 of 10 examples (`.engram/runs/d2-induce-fixture/results.jsonl` after `make run`).

**Consequence.** No registered config runs it. If H5 wants it, it is proposed in the pre-registration first.
