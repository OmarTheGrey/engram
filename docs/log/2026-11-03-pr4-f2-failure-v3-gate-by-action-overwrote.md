---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - Makefile
  - research/configs/h1-table.json
supersedes: none
---

**What.** `make h1-table GATE_BY_ACTION=1` wrote its sessions and table over the main table's files, so the two readings could not stand side by side, and nothing told a table which reading its sessions came from (V-3).

**Why.** The flag was added to the converter's call only; the paths and the config stayed the main table's.

**Result.** The gate-by-action reading now has its own sessions, config and table, and every session records the setting (`2026-11-03-pr4-f2-gate-by-action`).

**Consequence.** A second reading of one run gets its own files and a recorded flag, never the same paths.
