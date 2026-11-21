---
date: 2026-11-21
author: claude-agent
type: milestone
card: X15
chapter: evaluation
pillar: plane
hypothesis: H2
evidence:
  - research/results/h2-perf-budget-samples.jsonl
  - research/configs/perf-budget.json
  - "make perf-budget CHECK=1"
  - "make test-repro"
supersedes: none
---

**What.** Card X15's acceptance ran: the MANIFEST row of `research/results/h2-perf-budget.json` regenerates to its sha256 (`reproduce.check_row` on that row alone, the function `make test-repro` runs per row), and `make perf-budget CHECK=1` passed.

**Why.** The card's acceptance is a byte-stable result from the committed samples and a rerun inside the stated band.

**Result.** The row reproduced with no problem. The rerun check printed "rerun check passed" for all 51 cells, every query count equal; the largest moves were the bare SQLite read at 1,000 items (2.67 times the committed median) and the fake's medium read at 10,000 items (0.59 times). It took about 24 minutes, on the same machine and still shared with other agents.

**Consequence.** The committed samples stand; the rerun's samples were not kept.
