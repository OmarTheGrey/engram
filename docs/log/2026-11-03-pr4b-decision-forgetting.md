---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/results/h1-gatemem-reach.json
  - docs/decisions/0030-gatemem-principals-as-scopes-and-grants.md
supersedes: none
---

**What.** Recommended, for the lead's decision: GateMem's 727 access-control checkpoints are H1's primary set, and the 763 forgetting checkpoints a secondary set outside Holm; both are run (decision sheet item 9).

**Why.** Under ADR 0030 no field carries a deletion, so C5 retires nothing and the forgetting checkpoints test nothing the plane does.

**Result.** Under medium a pattern GateMem scores as a leak sits in a turn the asker reads on 565 of 763 forgetting checkpoints (74.0 percent) and 282 of 727 access-control ones (38.8 percent) (`research/results/h1-gatemem-reach.json`). On 23 access-control checkpoints the plane admits nothing, so C4 and C5 both show nothing there (`research/results/h1-c4-walk.json`).

**Consequence.** Either choice is one line of `research/configs/h1-table.json`, `gatemem_primary` (`docs/log/2026-11-03-pr4a-r1-decision-gatemem-sets.md`).
