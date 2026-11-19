---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/lint/model.ts
  - docs/tasks/L3.md
  - docs/log/2026-11-19-l3-failure-make-out-variable.md
  - research/scripts/l3_variance.py
supersedes: none
---

**What.** Review finding L3-8: four documentation errors.

**Why.** "Nothing is retried" ignored that liveJudgeCall retries transient 429, 5xx and network errors up to 3 times with the same request; the card said plainly done; the make OUT failure entry contradicted itself; the variance docstring did not say that an item flagged through the wrong pair counts as a true positive.

**Result.** Each corrected: the code comment, ADR 0008 amendment and architecture say only the parse is never retried; the card names branch l3-model-lints, PR #45, the engineering done and the live acceptance waiting for a key; the failure entry was edited before merging, with a note; the docstring states the caveat.

**Consequence.** The variance metrics decision is superseded by an entry of this date.
