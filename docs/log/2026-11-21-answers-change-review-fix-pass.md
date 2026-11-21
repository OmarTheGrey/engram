---
date: 2026-11-21
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - docs/tasks/lead-decisions.md
  - docs/tasks/backlog.md
  - research/configs/cost-table.json
  - research/analysis/holm.py
  - "uv run pytest -q research/tests/test_run_limits.py"
supersedes: docs/log/2026-11-21-answers-change-prereg.md
---

**What.** The answers card's review fix pass: findings ANS-1, 3, 4, 5, 7 to 11, and the lead's answers 57 to 59, rebased on main after R3, E2.7 and E2.8.

**Why.** The review found one critical and five important defects; the lead answered the two questions held for him and a third.

**Result.** v1 gains one numbered list of eight pre-tag conditions that the sections cite, ledger-dollar ceilings with price ratios, H1 pausing at a ceiling, the programme cap, M2's configuration, H3's fallback, rejected items excluded, a dated judge id, H2's sizes as counted, H4's one-family power, a corrected Holm line. `cost-table.json`'s GLM note is corrected (the cost table regenerates to sha256 `074d4fb0...`, unchanged); `holm.py`'s docstring names item 8. Four backlog rows are added.

**Consequence.** Card R2 may start.
