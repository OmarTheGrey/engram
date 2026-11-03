---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_h1_secondary.py
  - research/tests/test_h1_pipeline.py
supersedes: none
---

**What.** The gate-by-action table carried a full `primary`, `holm` and `decision` block shaped like the main table's, marked only by `gate_by_action: true`, so it could be read as deciding H1 (F-6).

**Why.** D2 gave the second reading its own files and flag, and the table code built the same block for both.

**Result.** Every table now records `decides`: true for the main table, false for the gate-by-action table, from the setting; the gate-by-action table drops the block (`2026-11-03-pr4-polish-decision-decides`). Two mutants are killed.

**Consequence.** A table that does not decide says so in a field, not by omission.
