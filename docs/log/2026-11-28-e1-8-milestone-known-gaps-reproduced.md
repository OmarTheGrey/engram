---
date: 2026-11-28
author: claude-agent
type: milestone
card: E1.8
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - specs/replay.qnt
  - specs/traces/putBackAcrossThirdErasureReplayTest.itf.json.gz
  - specs/traces/sweptIdPurgeRaceReplayTest.itf.json.gz
  - packages/core/test/model/trace-replay.test.ts
  - "make test-one T=packages/core/test/model/trace-replay.test.ts"
supersedes: none
---

**What.** The two known gaps of card E1.5 replayed on the code, restated in the order the code takes them (`putBackAcrossThirdErasureReplayTest`, `sweptIdPurgeRaceReplayTest`).

**Why.** The card requires them reproduced as the model states them.

**Result.** Both replay to their end with every compared state equal. The first ends with item b erased, its erased content in the store and every handle idle; the second with b projected and no store record.

**Consequence.** Card E1.7's fix turns both tests: their final-state expectations change with the code and the model.
