---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_analysis.py
supersedes: none
---

**What.** The first version of the test for pairing on kept seeds could not tell the two pairings apart.

**Why.** It excluded a C5 session of an item whose three C4 seeds agreed, so averaging C4 over all three seeds or over the two kept gave the same mean (0.4583 both ways).

**Result.** The test now excludes a C5 session of an item whose C4 seeds disagree, and asserts the unpaired mean differs from the paired one.

**Consequence.** None.
