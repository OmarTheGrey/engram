---
date: 2026-11-28
author: claude-agent
type: decision
card: E1.8
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/core/test/model/replay.ts
supersedes: none
---

**What.** What the replay compares, and its four declared abstractions.

**Why.** The model omits item status, versions and the order inside one transaction.

**Result.** (1) States are compared only where no handle is inside a stretch. (2) Status: a live model item is a code item that is not retired; any retired code item is no item. (3) The model's erase events of one transaction are put in id order. (4) An adoption's deny the code skips as a repeat of the same bytes (adopt.ts) is dropped from the model's trail. The trail holds every code event but one rule, `engram/adopt/retract`, left out because the model has no retraction and status (2) sees its effect.

**Consequence.** Cost if wrong: a difference inside these abstractions is not seen; the findings record where they matter.
