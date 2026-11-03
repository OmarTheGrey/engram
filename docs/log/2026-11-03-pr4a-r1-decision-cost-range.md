---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-cost.json
  - research/scripts/h1_cost.py
supersedes: docs/log/2026-11-03-pr4a-decision-cost-range.md
---

**What.** The cost range as before (low: the fixture's shape, four characters per token, one judge call, the recorded note; high: two more read turns, three characters per token, three judge calls, the note's 300-token limit), with reasoning per answer call split by whether thinking off reaches the model: 0 and 1,024 where it does, 256 and 4,096 where it does not.

**Why.** The superseded entry counted no reasoning in the low estimate for any model (review P4A-2). Neither pi-ai nor its catalogue states a default effort, so the floor is assumed, not sourced.

**Result.** 4,096 is not shown to cover a provider's default effort either, and 1,024 may not cover stray reasoning; so each candidate also reports what 1,000 reasoning tokens per answer call cost (54,152 calls low, 108,296 high), and any budget can be priced from the table.

**Consequence.** The first live sessions' usage ledger should replace these budgets before the full run.
