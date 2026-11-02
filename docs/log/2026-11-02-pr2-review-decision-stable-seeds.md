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
supersedes: none
---

**What.** Each H1 table bootstrap's seed is the first word of a numpy SeedSequence over the config's seed and four words of sha256(benchmark, model, contrast).

**Why.** A contrast's test must not move when sessions of another model or benchmark are added to the results file (review finding P2-10), and the seed must still come from the config (rule 6).

**Result.** Stable across platforms and file order. Cost if wrong: none statistically.

**Consequence.** None.
