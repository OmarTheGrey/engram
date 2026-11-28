---
date: 2026-11-28
author: claude-agent
type: change
card: E1.8
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - specs/replay.qnt
  - specs/commit.qnt
supersedes: none
---

**What.** `specs/replay.qnt` adds module `replay`: good's instance (same constants) with a step, `replayStep`, that restricts which of good's actions may come next, plus `replayThreeOffboardings` for the known gap.

**Why.** The code runs some pairs of model steps in one synchronous stretch with no store call between (a stale commit and its settle's read, an erasure and the sweep's head, the sweep and adoption loops), and deletes an erasure's records in id order. A trace that puts another handle between such steps cannot be followed by the code.

**Result.** Every `replayStep` is one of good's `step` actions, so every trace is a run of good. `quint test` passes the nine runs of the file (two gaps, seven findings).

**Consequence.** The traces of `specs/traces/` are generated from it; card E1.7 changes `commit.qnt` and the schedule with it.
