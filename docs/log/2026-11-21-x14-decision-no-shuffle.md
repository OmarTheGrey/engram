---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/configs/redteam.json
  - research/scripts/redteam.py
supersedes: none
---

**What.** The corpus is planted in file order, and the config's seed feeds only the bootstrap.

**Why.** P1 draws the order from the seed, but every entry has its own scopes, so order cannot change a row, and nothing is sampled.

**Result.** Every contrast's bootstrap seed comes from the config seed and a hash of the contrast, as `analysis.h1` does.

**Consequence.** None. Cost if wrong: none.
