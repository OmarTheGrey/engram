---
date: 2026-11-02
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/tests/test_analysis.py
supersedes: none
---

**What.** Planted test data give each item its own violation propensity per condition, Beta with the planted mean and a + b = 2.

**Why.** A test of the item as the unit of analysis needs seeds of one item to be correlated, as a model's answers to one item are (review finding P2-4); concentration 2 makes that correlation strong enough to separate items from sessions within 600 runs.

**Result.** Under a planted null the item-level analysis stays at or below 0.07 over 600 runs (the test), and with sessions as units it does not (mutation M1 fails the test). Cost if wrong: none for the code; a weaker effect would make the test less sensitive.

**Consequence.** None.
