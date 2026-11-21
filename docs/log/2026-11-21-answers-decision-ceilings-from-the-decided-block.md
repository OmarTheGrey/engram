---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/results/h2-cost-table.json
  - research/tests/test_run_limits.py
  - docs/log/2026-11-21-rv8-review-finding-credit-request-reasoning-off.md
supersedes: none
---

**What.** Each experiment config's `spend_ceiling_usd` is the sum of the `ceiling` of its run's rows in the cost table's `decided` reading (reasoning off, option `d-lead`), at OpenRouter's prices, the model under test priced as M1 and each judge as itself.

**Why.** Item 3 says 1.25 times the run's high estimate, per provider, without naming which estimate; RV8's review made the decided, reasoning-off figure the planning one and its ceiling 1.25 times that high. OpenRouter serves every call, so per provider is the run's total.

**Result.** 1,560.26 (H1 GateMem), 4.65 (H1 MEM-INV-Bench), 203.44 and 205.76 (H2's baselines). RV8's later finding advised setting the ceiling to the credit instead; item 3's answer is applied, since only the lead can change it.

**Consequence.** If wrong, a run stops early or late; `test_run_limits.py` recomputes each value from the table.
