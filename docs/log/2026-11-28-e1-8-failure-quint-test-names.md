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

**What.** `quint test --main=replay` printed the module name and passed with no test run.

**Why.** `quint test` selects runs whose names end in `Test` by default; the first runs were named `...Replay`.

**Result.** Renamed to `...ReplayTest`; the nine runs now report `ok` and write their ITF.

**Consequence.** Every scenario run in `specs/replay.qnt` ends in `Test`.
