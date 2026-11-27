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

**What.** Proposed for the lead: the split of each domain's tau2 `train` list into an induction half and a validation half by a seeded shuffle, `split_seed` 20261125: airline 15 and 15, retail 37 and 37.

**Why.** Card D3's split (`heldOutTasks`) removes from the replay pool every task a candidate was induced from, so a library induced from every successful train trajectory would be replayed only on the tasks the agent failed.

**Result.** 104 train tasks (airline 30, retail 74) at tau2 `v1.0.1`, as read in card B11's checkout; the 60 test tasks never reach induction or replay. Card H5P row 1.

**Consequence.** The lead's answer entry on this item supersedes this one; nothing is registered until then.
