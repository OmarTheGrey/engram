---
date: 2026-11-28
author: claude-agent
type: finding
card: E1.8
chapter: discussion
pillar: twin
hypothesis: none
evidence:
  - specs/replay.qnt
  - packages/core/test/model/replay.ts
  - packages/core/test/model/trace-replay.test.ts
  - packages/core/src/plane/offboard.ts
supersedes: none
---

**What.** E18-F8: the erasure erases an item a withdrawal to nothing left retired, which the model, having removed it, does not.

**Why.** The review found replay-074 filed under E18-F1 though its erase-event difference is this. With status compared that trace now first diverges at a retraction of another item; scenario `e18ErasesWithdrawnTest` diverges at step 19 (the offboarding's mark stays open in the code while it erases the retired item).

**Result.** `offboard.ts` takes every projected item of the scope, any status, as doomed, which is right for erasure; the difference is the model's missing status (E18-F6), seen at the erasure.

**Consequence.** For card E1.7: model item status, or remove a withdrawn item in the model only where the code does.
