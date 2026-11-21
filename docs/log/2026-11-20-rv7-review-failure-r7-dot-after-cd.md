---
date: 2026-11-20
author: claude-agent
type: failure
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/core/test/unit/no-bypass-posix.test.ts
  - "node shell-probe.ts <worktree> (the reviewer's probe, scratchpad)"
supersedes: none
---

**What.** Review finding RV7-R7: with a root inside the repository, `cd src && grep -r TODO .` was refused, because `.` was still judged against the original cwd.

**Why.** The first pass added each `cd` folder to the cwd and never took the cwd away.

**Result.** A chain of literal `cd dir &&` at the very start of a command now replaces the cwd, and `cd src && grep -r TODO .` passes. Still refused: a bare `grep -r TODO .`, `cd src; ...`, `cd src && cd .. && ...`, and a cd in a subshell or nested script. Mutation check: keeping the cwd fails 3 tests. On the reviewer's 39 ordinary commands, the probe refuses 7 with the root inside the repository, each a walk over `.`, and none in the other two layouts.

**Consequence.** ADR 0014 states the remaining cost.
