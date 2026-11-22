---
date: 2026-11-21
author: claude-agent
type: change
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/validate.ts
  - packages/core/src/plane/promote.ts
  - packages/core/test/unit/distill/validate.test.ts
  - packages/core/test/unit/plane/promote-replay.test.ts
supersedes: none
---

**What.** Core gains the replay admission decision (`distill/validate.ts`: heldOutTasks, replayProblem, scoreReplay, admission) and `Plane.promote` takes a replay (`PromoteOptions.replay`), from which it derives the validation record itself.

**Why.** Card D3 step 4; ADR 0026 left the record's source to D3, and before it no procedural candidate could become active through the plane.

**Result.** Before: `Plane.promote` passed no validation record, so every procedural candidate was denied `engram/promote/no-evidence`. After: a replay meeting replay_k of replay_n promotes in place with reason "the validation record 4 of 5 held-out tasks at or above 1 with the procedure (2 of 5 without it) meets 4 of 5"; one below leaves it a candidate with one deny event. 19 and 5 tests pass (`make test-one T=packages/core/test/unit/distill/validate.test.ts`, `T=packages/core/test/unit/plane/promote-replay.test.ts`); removing the induction-task check fails 3 of them.

**Consequence.** The evaluator's E2.5 behaviour is unchanged when no replay is presented: its 35 plane and 52 evaluator tests pass.
