---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - Makefile
  - research/configs/h1-table.json
  - research/configs/h1-table-gate-by-action.json
  - research/analysis/h1.py
  - research/tests/test_h1_secondary.py
  - research/tests/test_h1_pipeline.py
supersedes: none
---

**What.** `make h1-table GATE_BY_ACTION=1` writes `.engram/runs/h1-sessions-gate-by-action.jsonl` and `research/results/h1-table-gate-by-action.json` from `research/configs/h1-table-gate-by-action.json`. Both configs and tables record `gate_by_action`, and each table refuses the other setting's sessions.

**Why.** Shared design D2 (V-3).

**Result.** A planted run builds both tables side by side, each with its flag, and both mixed builds are refused. `make -n` shows each recipe's paths. AGENTS.md, CLAUDE.md, the Makefile help and both `how_to` lists say so. Two mutants are killed.

**Consequence.** The main table's files are never touched by the second reading.
