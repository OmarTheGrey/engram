---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.5
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - specs/commit.qnt
  - docs/tasks/backlog.md
supersedes: none
---

**What.** For the lead, review finding E1.5-1: the sweep's put-back can leave erased content in the store after a third offboarding of the same person.

**Why.** When the sweep finds a record it deleted was rewritten, it puts the item back (offboard.ts, the loop after a changed swept record). A third offboarding can erase the item between the put-back's read and its write; the next read finds it gone and the loop runs `break` without deleting what it wrote.

**Result.** `knownGapThreeOffboardings::putBackAcrossThirdErasureTest` ends with every handle idle, both reports appended, and b's erased content in the store: `not(erasureHolds)`. The good model's bound of two offboardings hid it.

**Consequence.** A core card should delete the record when the item is gone or its scope is being erased, as settle's `wanted` does; a backlog row names it.
