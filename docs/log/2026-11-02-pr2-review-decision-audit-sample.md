---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/scripts/h1_gatemem_reach.py
  - research/configs/h1-gatemem-reach.json
supersedes: none
---

**What.** The reach result holds a seeded sample of 25 scored-pattern matches per checkpoint kind (seed 20261102), each with its checkpoint, pattern, turn, route and turn text, for a person to audit by hand.

**Why.** Text matching cannot tell a secret from a coincidence ("Wednesday" in an unrelated turn); only a reader can, and the sample makes that check possible without rerunning anything.

**Result.** The sample is drawn from the primary preset's matches, without replacement, and sorted. The audit itself is a human step and is not done in this PR. Cost if wrong: 25 per kind estimates the coincidence rate to about plus or minus 0.2.

**Consequence.** PR 4 or the lead records the audit's result.
