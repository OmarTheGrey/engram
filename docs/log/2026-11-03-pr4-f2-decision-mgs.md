---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_h1_secondary.py
  - research/tests/test_h1_pipeline.py
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/test/research/h1-sessions.test.ts
supersedes: none
---

**What.** MGS = U x (1 - A) x (1 - F) per condition (D1). U is `utility_ok`, the judge's utility verdict, the rule scorer's where no judge ran; a null verdict leaves the item out. A and F are the table's access and forgetting rates. The interval is a percentile bootstrap resampling each part's items apart. Under gate-by-action a wrong action at a utility checkpoint is a miss.

**Why.** D1 names U the judge's utility accuracy. Upstream's judge makes a wrong action a utility miss only with `--gate_by_action`, so the gate-by-action table gives the Eq. 11 reading. The three parts are different checkpoints, so they share no pairing.

**Result.** Utility sessions carry kind `utility` and enter no rate, contrast or test.

**Consequence.** Upstream's promoted MGS uses utility and action both. The main table's U does not, and v1 says so.
