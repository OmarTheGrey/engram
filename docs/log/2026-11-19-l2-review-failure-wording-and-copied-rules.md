---
date: 2026-11-19
author: claude-agent
type: failure
card: L2
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/scripts/fault-set-check.ts
  - docs/tasks/L2.md
  - research/scripts/h3_fault_set.py
supersedes: none
---

**What.** Review finding L2-5 (minor) on PR #46: a copy of L3's planning rules in `packages/bench/src/faults/reach.ts`, and wording errors: the finding-on decision counted 500 superseded labels instead of 1,000, the card named the worktree branch and no PR, the README did not describe `finding_on`, and the script's docstring did not say the label check covers the model tier.

**Why.** L3 was not on main when the copy was written; the wording was not revised as the set changed.

**Result.** After rebasing onto main at `02bd0f1`, the check reads pairs and claims from core's `planModelLints` unit ids and `reach.ts` is deleted; the wording is fixed, the decision superseded.

**Consequence.** The model-tier check now follows L3's code wherever it changes.
