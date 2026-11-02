---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - docs/research/preregistration.md
supersedes: none
---

**What.** The poisoning arm "contradicts" H1 when its C4 minus C5 BCa interval on the primary model lies wholly below zero.

**Why.** H1's analysis says it is supported if the primary test passes "and the MPBench interval does not contradict it", without defining contradiction. An interval wholly below zero is the arm showing enforcement violating more than instruction; an interval that merely includes zero is an arm too small to tell.

**Result.** `decide_h1` reports the secondary arm as "contradicts", "does not contradict" or "absent", and H1 is not supported when it contradicts. Cost if wrong: a stricter reading (the interval must lie above zero) would make the 24-case arm decide H1, which its size cannot carry.

**Consequence.** PR 4 writes the definition into v1's H1 analysis.
