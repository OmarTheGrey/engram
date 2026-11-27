---
date: 2026-11-27
author: claude-agent
type: decision
card: H5P
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/research/preregistration.md
  - docs/tasks/H5P.md
supersedes: none
---

**What.** Each domain's tau2 `train` list is split once into an induction half and a validation half by a seeded shuffle, `draw_seed` 20261125: airline 15 and 15, retail 37 and 37.

**Why.** Card D3's split (`heldOutTasks`) removes from the replay pool every task a candidate was induced from, so a library induced from every successful train trajectory would be replayed only on the tasks the agent failed.

**Result.** 104 train tasks (airline 30, retail 74) at tau2 `v1.0.1`, as read in card B11's checkout; the 60 test tasks never reach induction or replay. Proposed, card H5P item 1.

**Consequence.** The lead approves, changes or refuses it; nothing is registered until then.
