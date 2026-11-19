---
date: 2026-11-20
author: claude-agent
type: decision
card: RV7
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - docs/decisions/0014-no-bypass.md
supersedes: none
---

**What.** A tree walk with no path argument (`find`, `rg x`, `grep -r x`) is not judged against the cwd. Recursion and `cd` targets are judged over the whole command, not per segment.

**Why.** Checking the implicit cwd would refuse every bare `rg` or `find` in a project that holds a store root, including the pi dogfood's. Telling a walker's pattern from its path needs a parser per tool. Whole-command judgement reuses the flat word list the check already builds, and errs towards blocking, as ADR 0014 does elsewhere.

**Result.** Recorded as a limit and a cost in ADR 0014's RV7 amendment. An explicit `.` is judged, so `grep -r x .` from the folder holding the root is refused.

**Consequence.** If the lead wants the implicit cwd closed, a walker with no path word in its segment needs a per-segment parse.
