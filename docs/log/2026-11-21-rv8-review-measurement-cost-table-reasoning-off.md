---
date: 2026-11-21
author: claude-agent
type: measurement
card: RV8
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/h2-cost-table.json
  - "uv run python research/scripts/cost_table.py --config research/configs/cost-table.json --out research/results/h2-cost-table.json"
supersedes: docs/log/2026-11-20-rv8-measurement-cost-table-leads-set.md
---

**What.** The cost table regenerated with reasoning off in the decided block and H4's shared Mem0 arms left out; MANIFEST row research/results/h2-cost-table.json.

**Why.** Review findings RV8-2 and RV8-4 changed the decided figures and, through the shared arms, H4's registered ones.

**Result.** As decided (reasoning off, `decided.totals`, `d-lead`): 1,159 to 5,227 dollars, ceiling 6,534, 348,842 to 660,296 calls; H1 274 to 1,252, H2 647 to 2,154, H3 57 to 347, H4 18 to 75, H5 164 to 1,399. With the allowance (sensitivity): 1,159 to 6,856, ceiling 8,569. As registered (`1d-lead/2a/47c`): 1,394 to 11,990, ceiling 14,988; H1 274 to 1,691 as before.

**Consequence.** The planning figure is the reasoning-off one; the registered figures stay for the comparison.
