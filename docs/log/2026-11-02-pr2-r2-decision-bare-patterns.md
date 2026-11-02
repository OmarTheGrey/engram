---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-gatemem-reach.json
  - research/scripts/h1_gatemem_reach.py
supersedes: none
---

**What.** A pattern is bare when, stripped and lowercased, it is "yes", "no", "true" or "false", or has three characters or fewer.

**Why.** The review asks how far generic patterns inflate the reach; the second verifier's script used this definition, and keeping it makes the numbers comparable.

**Result.** The reach counts checkpoints with a bare pattern, with only bare patterns, and with a pattern that is exactly yes or no, for the leak targets and the scored set. Cost if wrong: longer generic patterns ("Wednesday") are not counted, so the counts are a floor.

**Consequence.** None.
