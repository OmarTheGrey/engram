---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - research/analysis/h1.py
  - research/scripts/h1_table.py
  - research/configs/h1-table.json
  - research/tests/test_h1_pipeline.py
  - "make h1-table"
supersedes: docs/log/2026-11-03-pr4a-r1-h1-pipeline.md
---

**What.** H1's pipeline with sets: `h1-sessions/2` gains GateMem's optional `kind` ("access" or "forgetting"), and the table runs the primary test on the set the config names, with the other sets and a sensitivity table beside it.

**Why.** Orchestrator's items 8 and 9, after part B's v1 draft; the superseded entry described the pipeline before them.

**Result.** Before: one pooled GateMem test. After: `rates`, `contrasts`, `primary` and `decision` on the primary set; `secondary` (two sets, unadjusted) and `sensitivity` (the primary set without `research/results/h1-refusal-leaks.json`'s items, which the table hashes). `make h1-table` is unchanged in use: `make run` per arm, then `make h1-table`, with `READINGS=<file>` once two members have read the UNREAD sessions; `research/configs/h1-table.json` spells out the steps.

**Consequence.** The lead's set choice is one config line.
