---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - Makefile
  - research/configs/h1-table-gate-by-action.json
  - research/analysis/h1.py
supersedes: none
---

**What.** The gate-by-action reading's files follow D2's names: `.engram/runs/h1-sessions-gate-by-action.jsonl`, `research/configs/h1-table-gate-by-action.json` and `research/results/h1-table-gate-by-action.json`. Every session records `gate_by_action`; a session without the field counts as false.

**Why.** Sessions converted before the flag existed were leak only, the converter's default. One Makefile variable keeps the two recipes from drifting apart.

**Result.** A table refuses any session whose setting differs from its config's. The two configs differ only in name, sessions and flag, and a test checks that.

**Consequence.** The gate-by-action table needs the same `READINGS=` as the main one when the members read UNREAD sessions.
