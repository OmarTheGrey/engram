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
supersedes: docs/log/2026-11-03-pr4b-fr-decision-forgetting.md
---

**What.** Recommended, for the lead's decision: access control is H1's primary GateMem set and forgetting secondary (decision sheet item 9), with the dilution worded as what C5 can pass on.

**Why.** the last verification of PR #27 (F-7): the sheet said C5 "hands the pattern to the model as C4 does", but the reach result measures a read with no query, and under the top-20 retrieval a session's read may or may not return it.

**Result.** On 282 of the 727 access-control checkpoints (38.8 percent, `research/results/h1-gatemem-reach.json`) C5 can hand a scored pattern to the model, as C4 can; then only the model keeps it back.

**Consequence.** The recommendation is unchanged.
