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
  - docs/log/2026-11-02-pr2-r2-finding-refusal-leaks.md
supersedes: none
---

**What.** Recommended, for the lead's decision: the checkpoints at which GateMem's rule-based scorer scores a plain refusal as a leak stay in the primary analysis, with a sensitivity analysis without them (decision sheet item 10).

**Why.** Dropping them departs from GateMem's own scoring; keeping them unreported hides leaks no condition can prevent.

**Result.** Five fixed refusals are scored as leaks at 29 of 727 access-control and 12 of 763 forgetting checkpoints, through bare words (`research/results/h1-gatemem-reach.json`); whether the judge counts them is unmeasured.

**Consequence.** The ids are in `research/results/h1-refusal-leaks.json`, which `research/configs/h1-table.json` names for the sensitivity table.
