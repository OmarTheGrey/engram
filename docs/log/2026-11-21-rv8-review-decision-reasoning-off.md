---
date: 2026-11-21
author: claude-agent
type: decision
card: RV8
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/results/h2-cost-table.json
  - research/configs/cost-table.json
  - research/tests/test_cost_table.py
supersedes: none
---

**What.** The `decided` block of the cost table prices reasoning off: `decisions.reasoning.off_honoured_tokens` is 0 at both estimates, and GLM 5.3 Flash, whose off switch is ignored, keeps its 256 and 4,096.

**Why.** The lead's item 1 says reasoning off; the registered figures (`totals`) stay as registered, so the decided set is a separate reading with the allowance as a stated sensitivity.

**Result.** `decided.totals` is the planning figure and the RV1 ceiling comes from its high estimate; `decided.totals_with_allowance` keeps the 1,024 as a sensitivity; each row carries `dollars_decided` beside `dollars`. Tests: an honoured switch costs no reasoning, GLM's allowance is kept, the ceiling is 1.25 times the decided high.

**Consequence.** If the lead wants the registered allowance in the ceiling, the sensitivity block gives that figure with no rerun.
