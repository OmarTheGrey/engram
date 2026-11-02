---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/scripts/h4_holm_levels.py
  - research/tests/test_h4_holm_levels.py
  - research/results/h4-holm-levels.json
supersedes: none
---

**What.** H4's Holm-threshold check is a separate rule-9 result read by a fast test, not a new branch of `research/scripts/h4_power.py`'s gate.

**Why.** The orchestrator's brief allowed a test or a recorded check, and asked the gate extended only if a size failed. A separate record leaves PR #26's table and its sha256 untouched and costs one search per size and threshold, not a rerun of the power walk.

**Result.** No size failed, so the gate is unchanged. The test ties the record to the table by sha256 and to its exact list of 26 committed sizes, so a regenerated power table with any new size fails `make test` until the record is regenerated with it.

**Consequence.** If v1 changes the power config, both scripts rerun; if a size then fails at some threshold, the gate in `h4_power.py` must take the check.
