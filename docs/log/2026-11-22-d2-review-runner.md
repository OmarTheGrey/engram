---
date: 2026-11-22
author: claude-agent
type: change
card: D2
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/runner/src/induce.ts
  - packages/runner/scripts/run.ts
  - packages/runner/test/induce.test.ts
supersedes: docs/log/2026-11-21-d2-runner.md
---

**What.** The runner's row for the control reports its two deduplications (`dedup`) instead of a run of tools. The runner test checks each stored candidate's kind against its own sessions, and that the write reason names that source (finding D2-4).

**Why.** Card D2 steps 4 and 5 (the superseded entry said steps 5 and 6, which a five-step card does not have), and the review.

**Result.** 4 tests pass. Setting the source to `user` fails 1.

**Consequence.** None.
