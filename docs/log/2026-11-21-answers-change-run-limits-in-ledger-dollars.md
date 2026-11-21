---
date: 2026-11-21
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-gatemem.json
  - research/configs/h1-mem-inv.json
  - research/configs/h2-longmemeval-c2.json
  - research/configs/h2-longmemeval-c5-medium.json
  - research/tests/test_run_limits.py
supersedes: docs/log/2026-11-21-answers-change-run-limits.md
---

**What.** The four ceilings move from list to ledger dollars: 1,560.26 to 945.29, 4.65 to 2.32, 203.44 to 102.29, 205.76 to 103.45; the smoke configs gain `turn_limit` 8.

**Why.** Review finding ANS-1: the ledger prices calls at pi-ai's catalogue.

**Result.** `test_run_limits.py` recomputes each ceiling at the recorded catalogue prices and checks those prices against pi-ai's own file, each ratio, the table's list dollars from its tokens, and each figure on its run's line of v1, to the cent (ANS-9). It failed first (11 of 31), then passed 31; a ceiling of 945.30 fails two tests, a catalogue price of 0.67 fails ten.

**Consequence.** No committed result moves.
