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
supersedes: docs/log/2026-11-03-pr4b-decision-forgetting.md
---

**What.** Recommended, for the lead's decision: access control is H1's primary GateMem set and forgetting secondary (decision sheet item 9), with the primary set's own dilution weighed.

**Why.** the final verification of PR #27 (V-12): the sheet weighed only the forgetting set's dilution and said the empty checkpoints "add no difference".

**Result.** On 282 of the 727 access-control checkpoints (38.8 percent) a scored leak pattern sits in a turn the asker can read (`research/results/h1-gatemem-reach.json`), so C5 hands it to the model as C4 does; the 23 empty checkpoints pull C4 minus C5 toward zero.

**Consequence.** Either choice remains one line of `research/configs/h1-table.json`.
