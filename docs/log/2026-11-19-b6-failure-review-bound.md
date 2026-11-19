---
date: 2026-11-19
author: claude-agent
type: failure
card: B6
chapter: limitations
pillar: research
hypothesis: H2
evidence:
  - docs/log/2026-11-19-b6-finding-clock-options.md
  - research/results/h2-longmemeval-ttl.json
supersedes: none
---

**What.** Review P6-1: my finding called 7.6 points the most the ttl could move H2's primary contrast; it is not a bound.

**Why.** I counted only questions that lose an evidence turn (38), but any hidden turn that would have reached C5's top 20 changes its prompt, in any of the 54 questions, and in either direction.

**Result.** The bound is 10.8 points (54 of 500); 7.6 is the scenario where each lost evidence turn costs its answer. Corrected in B6.md, PR.md and `docs/log/2026-11-19-b6-finding-clock-options-bound.md`.

**Consequence.** None for the code or the results.
