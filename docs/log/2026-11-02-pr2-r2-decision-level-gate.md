---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/analysis/power.py
  - research/scripts/h4_power.py
supersedes: docs/log/2026-11-02-pr2-review-decision-level-gate.md
---

**What.** A size enters the H4 table only if the TOST's exact level at kappa 0 is at most alpha under both seed models, and its level measured over 4,000 runs either way round, at kappas 0.02, 0.05, 0.1 and the cell's own under both seed models, is at most alpha by two standard errors.

**Why.** The review asked that no reported size admit a true level above alpha: where an exact computation exists it decides, and elsewhere the measurement must clear alpha by its own error.

**Result.** Exact means a sum over the multinomial counts at kappa 0, with the probability left out of the sum added back, so the value is never below the true level. Cost if wrong: the small-kappa grid may miss a worse kappa between its points.

**Consequence.** Each size carries its exact levels and its worst measured level.
