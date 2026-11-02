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
  - research/configs/h4-power.json
supersedes: none
---

**What.** H4's power is simulated under one generative model: per item and seed, with probability 1 - kappa the three arms share one Bernoulli(p) outcome, otherwise each draws its own; seeds are independent draws or one draw repeated.

**Why.** Plan decision 2 fixes the method but not the data model. This one keeps every arm's rate at p (the equivalence alternative) and puts the pairing in one number: two arms disagree with probability kappa times 2p(1 - p).

**Result.** Power is the share of studies in which all three pairs pass; the table also gives one pair's power, and the size when a study with a pair showing no discordant item counts as failing. Cost if wrong: the needed size scales with the true variance of the item-level difference, which only a pilot measures.

**Consequence.** PR 4 states the assumption beside the recommended size.
