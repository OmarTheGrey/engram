---
date: 2026-11-03
author: claude-orchestrator
type: decision
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/prereg-v1-plan.md
supersedes: none
---

**What.** PR 4 began while PR 2 was in its final verification, built on PR 2's head (`ce45b0d`), and was rebased onto PR 2's squash commit once PR 2 merged. It ran as two agents in sequence on one branch: part A built the evidence and the H1 pipeline, part B the v1 text, the decision sheet and the readiness record.

**Why.** The plan starts PR 4 after PRs 2 and 3 merge. Part A only adds to PR 2's code, so starting on its verified head saved a verification round's hours, at the cost of a rebase. Part B needs part A's numbers.

**Result.** PR 2 merged unchanged (the squash commit `b688cb0` has `ce45b0d`'s tree), and part A replayed onto it with `git rebase --onto b688cb0 ce45b0d` without a conflict.

**Consequence.** Part B starts from part A's last commit; a review of part A runs beside it.
