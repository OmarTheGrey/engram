---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - docs/research/preregistration.md
  - docs/tasks/prereg-v1-plan.md
supersedes: none
---

**What.** F-5: v1 and the sheet defined MGS's U as `utility_ok` alone without saying it is neither upstream's U nor the paper's Eq. 10, nor that it makes the table's MGS differ from the run's `summary.json`.

**Why.** Part A's code choice was described, not weighed against upstream's scorer and `promoteJudgeMetrics`.

**Result.** Found by the last verification of PR #27 or the final verification before it.

**Consequence.** Item 20 now recommends effective utility, states the code change before the tag, and keeps `utility_ok` alone as the alternative.
