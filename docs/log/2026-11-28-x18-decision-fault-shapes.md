---
date: 2026-11-28
author: claude-agent
type: decision
card: X18
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/governance-faults/inject.ts
  - packages/core/src/schema.ts
  - packages/core/src/plane/read.ts
supersedes: none
---

**What.** The six faults. At the projection: deletion drops the item's row, supersession restores the closed item's version 1 row, missing metadata blanks its provenance ref. In the log: deletion turns the target's carrying event into a deny, supersession reopens the close event's valid_to, missing metadata blanks the event item's provenance ref. The store is never faulted.

**Why.** Missing metadata is a blank ref only: every B5 item's window is already open at its end, and the schema requires valid_from. The store is untouched because C5's core-pipeline read and the lints read only the projection (read.ts).

**Result.** One fault per base, operator and place, each on its own copy of the clean log, so pairs never interact.

**Consequence.** Two U6 variants are not measured: a validity window removed, and a deletion as an item retired without a governed event. The result's limits say so.
