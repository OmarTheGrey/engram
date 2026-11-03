---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/configs/h1-gatemem.json
supersedes: docs/log/2026-11-03-pr4b-decision-violation.md
---

**What.** Recommended, for the lead's decision: GateMem's leak without the wrong action in the primary table, the paper's Eq. 11 reading in a separate gate-by-action table, MEM-INV-Bench as upstream scores it (decision sheet item 14).

**Why.** the final verification of PR #27 (V-3, V-18, V-4): the sheet did not name the departure from GateMem's Eq. 11, `GATE_BY_ACTION=1` rebuilt the primary table in place, and the rule scorer was described as deciding sessions.

**Result.** The judge decides every live GateMem session. `make h1-table GATE_BY_ACTION=1` writes its own sessions, config and table (`research/results/h1-table-gate-by-action.json`); each table records `gate_by_action` and refuses sessions of the other setting. MGS appears in both readings.

**Consequence.** If the lead prefers Eq. 11, the two tables swap roles; no code changes.
