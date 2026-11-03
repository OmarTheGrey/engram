---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/configs/h1-table.json
  - research/tests/test_h1_exclusions.py
supersedes: none
---

**What.** H1's table has three fixed GateMem sets, "access", "forgetting" and "access and forgetting"; `gatemem_primary` in `research/configs/h1-table.json` names the primary one (now "access"), and the other two are reported as secondary, so the lead's choice is that one line.

**Why.** Part B's v1 recommends access control as primary and forgetting as secondary (item 8); deriving the secondary sets from the primary keeps every other part of the config fixed whatever the lead decides.

**Result.** Only the primary set's C4 minus C5 p-value enters Holm and the decision; secondary sets report GateMem rates and contrasts, `adjusted: false`, no decision. Their bootstraps take the set's name into the seed, so they are drawn apart from the primary's, which keeps the seed it had. MEM-INV-Bench stays in the primary table only. A table naming a set refuses a GateMem session without a `kind`.

**Consequence.** Other sets mean editing `GATEMEM_SETS` in `research/analysis/h1.py`.
