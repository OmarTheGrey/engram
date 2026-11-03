---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/X1.md
  - docs/tasks/R1.md
  - docs/tasks/X2.md
  - docs/tasks/X3.md
  - docs/tasks/X4.md
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Cards R1, X1, X2, X3 and X4 state what is ready and what each waits on, and two backlog rows follow.

**Why.** Part B's brief, deliverable 4.

**Result.** X1: done in PR #25, merged as `33cc387`; its stale "ADR 0009, amended" now says the amendment is proposed. R1: v1 drafted, awaiting the lead's answers, the code they need, the label audit, the tag and the deposit. X2 and X3: ready once tagged with a key, sizes from COUNT; X3's benchmark is MEM-INV-Bench, its file name kept. X4: the analysis code, the converter and the table's sets exist; left are the effect sizes and figure, the run with the UNREAD readings, and committing the table's input. Backlog: the MPBench row records the move, the GateMem deletion row the sheet's recommendation.

**Consequence.** The orchestrator writes PR 4's number back.
