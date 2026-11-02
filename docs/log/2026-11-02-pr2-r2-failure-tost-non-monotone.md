---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - docs/log/2026-11-02-pr2-review-decision-tost-method.md
  - research/tests/test_equivalence.py
supersedes: none
---

**What.** Review finding V1: the round-one TOST's decision was not monotone in the evidence.

**Why.** It switched from an exact bound to the bootstrap at 10 items differing towards a side, so at 761 items and a 2-point margin, with k items at -1/3 and k at +1/3 (mean 0), it declared equivalence for k up to 7, refused it at 8 and 9, and declared it again from 10; the power table's sizes in sparse cells were set by where that gap closed.

**Result.** The route is gone: one score test decides at every count (decision entry `2026-11-02-pr2-r2-decision-score-tost.md`). Property tests require that removing disagreement at a fixed mean never turns equivalence into a refusal.

**Consequence.** None beyond the test.
