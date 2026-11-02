---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - research/scripts/h4_power.py
  - research/results/h4-power.json
  - research/analysis/equivalence.py
supersedes: none
---

**What.** PR #26's H4 table checked the TOST's level at 0.05 and 0.01 only, while H4's one p-value can meet Holm at 0.05 / k for any k from 1 to 5.

**Why.** Holm over the five primary p-values compares H4's intersection-union p with 0.05, 0.025, 0.0167, 0.0125 or 0.01, depending on its rank; the level of "reject when p is below a threshold" must hold at each threshold it may meet, and holding at 0.01 and 0.05 does not imply holding between them. Found by PR #26's final verification (P2v4-1), which checked 20 of the 26 distinct alpha-0.01 sizes and left 7,241 to 20,480 items at 2 points unchecked.

**Result.** PR 4 records the check at every threshold for every committed alpha-0.01 size (`research/results/h4-holm-levels.json`, entry `2026-11-03-pr4a-measurement-h4-holm-levels`).

**Consequence.** A test now fails if the power table changes without the record following it.
