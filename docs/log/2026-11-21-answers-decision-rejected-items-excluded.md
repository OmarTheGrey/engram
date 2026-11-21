---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - docs/research/label-audit.md
supersedes: none
---

**What.** A label-audit item rejected by two of the three members is excluded from its benchmark's analysis and listed in v1 whether or not the stop trips; the stop rule decides only what happens to the run, through `on_stop` (the coordinator's decision under the lead's delegation).

**Why.** Item 6 said what a tripped stop does to rejected items and left those below the threshold unstated.

**Result.** v1's Benchmarks paragraph and `docs/research/label-audit.md` say so; the H1 table has no input for excluded items yet, so pre-tag condition 1 names it and a backlog row tracks it.

**Consequence.** The audit's PR lists the items and gives the H1 table its exclusion list.
