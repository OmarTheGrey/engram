---
date: 2026-11-28
author: claude-agent
type: failure
card: E1.8
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - specs/replay.qnt
supersedes: none
---

**What.** A parameterised `schedule` module imported by two instances (`export M.*`) failed: `quint run` reported an uninitialised constant and `quint test` ran nothing.

**Why.** Quint 0.33.1 did not carry the constants through the nested instance and export.

**Result.** Each module now imports `commit` directly; only `replay` carries the schedule, since the three-offboarding run needs no step.

**Consequence.** None beyond the two direct imports.
