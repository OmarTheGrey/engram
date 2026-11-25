---
date: 2026-11-25
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/absorb-plan-2.md
  - docs/research/preregistration.md
supersedes: none
---

**What.** Between the tag and the merge of H1's shards, nothing merges that changes code a registered config runs; only tests, specs, research scripts with new configs and new read-only commands.

**Why.** H1 runs from 1 to 8 December as four shards that may be resumed. A shard resumed from a moved main would refuse to continue or, worse, run other code.

**Result.** Wave 1 (W9) holds E8.16, E1.8, X16 and E9.10, none of which touches the runner, the model package, the bench sources, core's condition paths or the registered configs. Core changes start at E1.7 in W10.

**Consequence.** If wrong, it costs about a week of core work moved later.
