---
date: 2026-11-28
author: claude-agent
type: finding
card: X19
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - research/results/h3-erasure-residue.json
  - packages/core/src/plane/offboard.ts
supersedes: none
---

**What.** A Letta MemFS repository keeps every erased canary in its git objects: 160 of 160 erasable canaries on both backends, 158 in no live record.

**Why.** Each write is a commit; a delete is a new commit. The deletion report already says the store keeps a history of its own (`native_history`) and asks the person to erase it there.

**Result.** Measured, not new: the report's not_reached line is right.

**Consequence.** For card E9.13: shredding sealed content covers Letta's history only if the store holds ciphertext.
