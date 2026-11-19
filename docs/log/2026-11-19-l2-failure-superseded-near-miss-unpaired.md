---
date: 2026-11-19
author: claude-agent
type: failure
card: L2
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/bench/test/faults/generate.test.ts
  - packages/bench/src/faults/bank.ts
supersedes: none
---

**What.** The new test that every contradiction label is a pair L3's lint sends failed on question `3d86fd0a`: the superseded near-miss was not paired.

**Why.** The near-miss's later update was about another attribute ("Update: my <other> is now ..."), so it shared only "my" and "is" with the statement and fell outside both items' five nearest. L3 would never judge the pair, and the near-miss would test nothing. The label check on the committed fixture set before the fix counted 57 of 60 model-tier near-misses sent.

**Result.** The near-miss update now keeps the attribute and value ("Update: my <attribute> is still <value>."), which the lint pairs and should find consistent; 60 of 60 are sent.

**Consequence.** A near-miss for a pairwise lint must share the fault's words.
