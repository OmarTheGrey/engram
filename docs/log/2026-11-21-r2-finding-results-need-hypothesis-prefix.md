---
date: 2026-11-21
author: claude-agent
type: finding
card: R2
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_prereg.py
  - research/results/MANIFEST.md
  - docs/tasks/X14.md
supersedes: none
---

**What.** `research/tests/test_prereg.py` requires every MANIFEST result to match exactly one hypothesis's Results glob (`research/results/h1-*` to `h5-*`). A result named `redteam.json` or `injection_screen.json` would fail it.

**Why.** Cards X14, E2.9, E2.10 and L5 each add a result with a MANIFEST row, and their cards do not name the file under a hypothesis prefix.

**Result.** Every one of the 17 MANIFEST rows today starts with `h1-` to `h4-`. The proposals' rules now say a card names its result under the prefix of the hypothesis it serves, and card X14 names `research/results/h1-redteam.json`. A result that serves no hypothesis, such as U3, U5 or U7, needs the test's rule amended when its arm is registered.

**Consequence.** Cards E2.9, E2.10 and L5 should pick an `h1-` or `h3-` name before they write their MANIFEST rows.
