---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_h1_secondary.py
  - research/tests/test_h1_pipeline.py
  - research/configs/h1-table-gate-by-action.json
supersedes: none
---

**What.** Every H1 table records `decides`, true for the main table and false for the gate-by-action table, from `gate_by_action`. The gate-by-action table drops its `primary`, `holm` and `decision` block (F-6).

**Why.** A decision block in a table that decides nothing invites reading it as H1's. Everything worth comparing stays: the rates, the contrasts with C4 minus C5 and its p-value, the sets, the sensitivity table and MGS.

**Result.** Part B's text names `decides` and says the gate-by-action table has no decision block.

**Consequence.** If the lead wants the gate-by-action reading's Holm bound beside the main one, it is one condition in `build_h1_table` to keep the block.
