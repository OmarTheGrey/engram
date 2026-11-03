---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_h1_pipeline.py
supersedes: none
---

**What.** In the review fix pass the sensitivity-table mutant's first pattern matched nothing in `research/analysis/h1.py`, so that run tested the unmutated code; it was reported only after a rewritten pattern was killed, and the first run had no failure entry (P4V-3).

**Why.** The mutation runner printed "pattern found 0 times; skipped", and the line was read past while the batch's results were collected.

**Result.** This entry records it. The rewritten mutant was killed then, and every mutant of this round was checked to apply before its run was read.

**Consequence.** Check that a mutant applied before reading the run.
