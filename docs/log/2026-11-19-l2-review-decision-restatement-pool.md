---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/bank.ts
  - packages/bench/src/faults/generate.ts
supersedes: none
---

**What.** A supersession's later statement, a conflict's restatement and both near-misses draw from one pool of five restatements with no cue of change ("These days my X is Y.", "To be clear, my X is Y.", ...), and the first statement from a pool of three; the seed picks a template per item.

**Why.** Review finding L2-1: "Update: ... now" against "Update: ... still" let one fixed word tell a fault from its near-miss. With one pool, only the value does. A supersession and a conflict then differ only in time (a later session against the same moment), which L3's contradiction prompt does not see.

**Result.** A test checks that both kinds use several templates of the pool, and none says "Update:" or "still".

**Consequence.** Every restatement keeps "my", the attribute and "is", so L3's planning pairs it with its statement; the label check confirms it.
