---
date: 2026-11-21
author: claude-agent
type: failure
card: X14
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/redteam/run.ts
supersedes: none
---

**What.** The first full run, one plane per cell, took 9 minutes for four settings.

**Why.** The plane's write and read cost grows with its log: 400 entries took 1.2 seconds, 1,600 took 13.6.

**Result.** Each cell now runs blocks of 64 entries on fresh logs; seven settings take about 80 seconds, and a test shows the rows do not depend on the block size.

**Consequence.** None for results; the growth itself is card X15's subject, not this card's.
