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

**What.** What the replay compares, and three declared abstractions.

**Why.** The model omits item status, versions and the order inside one transaction.

**Result.** States are compared only where no handle is inside a stretch. An item the code holds as retired by a withdrawal to nothing is no item, as the model has it. The model's erase events of one transaction are put in id order. An adoption's deny the code skips as a repeat of the same bytes (adopt.ts) is dropped from the model's trail. Everything else must be equal.

**Consequence.** Cost if wrong: a difference inside these abstractions is not seen; the findings below record where they matter.
