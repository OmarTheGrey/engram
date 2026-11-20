---
date: 2026-11-20
author: claude-agent
type: measurement
card: RV8
chapter: results
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-frontier-axes.json
  - "uv run python research/scripts/frontier_axes.py --config research/configs/frontier-axes.json --out research/results/h2-frontier-axes.json"
supersedes: none
---

**What.** The frontier-axis measurement, MANIFEST row research/results/h2-frontier-axes.json.

**Why.** RV-DES-2; lead-decisions item 21.

**Result.** GateMem, against medium: grants off hides 64,987 turn reads on 1,154 checkpoints, removes the leak from reach on 91 of 282 access and 201 of 565 forgetting checkpoints, and cuts utility checkpoints with every include in reach from 424 to 298. Budget 25 hides 9,740 (forgetting leaks 565 to 553); ttl 1 day 4,544. LongMemEval: medium hides 11,122 turns on 54 questions; ttl 30 days 34,688 on 148, 180 days 2,625 on 13, 365 days none; budget 400 hides 53,683 and costs 164 questions evidence, budget 100 costs 417. No variant except no-model-source denies a write (5,795 GateMem turns, 124,334 LongMemEval).

**Consequence.** See the finding on which axes are flat.
