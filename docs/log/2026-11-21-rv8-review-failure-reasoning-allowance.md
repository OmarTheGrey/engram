---
date: 2026-11-21
author: claude-agent
type: failure
card: RV8
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/h2-cost-table.json
  - research/configs/cost-table.json
supersedes: none
---

**What.** The high estimate and the RV1 ceiling charged 1,024 reasoning tokens a call to DeepSeek v4 pro and Mistral Large 4 (review finding RV8-2).

**Why.** The lead decided reasoning off, and both models honour the off switch, so the allowance (`off_honoured` = 1,024) applied to calls that reason not at all.

**Result.** H1's high was 1,691 dollars instead of 1,252, and the kept runs' high 7,178 instead of about 5,430 (the reviewer's figure, before the shared arms of finding RV8-4); the ceiling, 1.25 times the high, followed, so a run's stop sat too high.

**Consequence.** The `decided` block now uses no reasoning tokens where the switch is honoured; see the decision entry of this pass.
