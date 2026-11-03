---
date: 2026-11-03
author: claude-agent
type: finding
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-table.json
  - research/scripts/h1_table.py
  - Makefile
supersedes: docs/log/2026-11-03-pr4b-finding-h1-pipeline-gaps.md
---

**What.** The H1 table's input is not in the repository, so `make test-repro` could not regenerate it as the pipeline stands; the superseded entry's other gap, pooled GateMem kinds, is closed.

**Why.** The orchestrator asked to check the finding against part A's fixed `make h1-table`.

**Result.** `make h1-table` writes `research/results/h1-table.json`, but `research/scripts/h1_table.py` reads `sessions` from `research/configs/h1-table.json`, `.engram/runs/h1-sessions.jsonl`, which git ignores; the readings come in by `READINGS=` from a file outside the repository too. The refusal-leak list the table hashes is committed. Part A's `h1-sessions/2` and `gatemem_primary` closed the pooling gap.

**Consequence.** The PR that runs H1 commits the final sessions file and the filled readings under `research/`, points `sessions` at them, and adds the table's MANIFEST row (the plan's section 7).
