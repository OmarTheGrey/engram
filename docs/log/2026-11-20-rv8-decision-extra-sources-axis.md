---
date: 2026-11-20
author: claude-agent
type: decision
card: RV8
chapter: design
pillar: research
hypothesis: H2
evidence:
  - research/configs/frontier-axes.json
supersedes: none
---

**What.** Beside the four axes asked for, the frontier measures a fifth: whether model content is admitted to person scope at write (`no-model-source`).

**Why.** None of the four can deny a write on either benchmark (both write every turn into its speaker's person scope at confidence 0.9), so without it the table would report no write denial at all and say nothing about where one could come from.

**Result.** It is the only axis that denies writes on both benchmarks (the measurement entry).

**Consequence.** If the lead considers it, it is a stance change (ADR 0004 already keeps model content in person scope), not a strictness level.
