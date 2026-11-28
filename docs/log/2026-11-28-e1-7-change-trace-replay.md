---
date: 2026-11-28
author: claude-agent
type: change
card: E1.7
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/core/test/model/replay.ts
  - packages/core/test/model/trace-replay.test.ts
  - packages/core/test/model/replay-report.ts
  - specs/traces/
supersedes: none
---

**What.** The trace replay moves E18-F1, E18-F2 and E18-F4 from FINDINGS to a new FIXED map (no marks made for them, so a divergence of their kind is unexplained again), their scenarios become tests that replay to the end, and the two gap tests assert the closed state.

**Why.** The card requires the gap scenarios to match after the fix, and a closed finding must not keep explaining divergences.

**Result.** `make test-one T=packages/core/test/model/trace-replay.test.ts`: 225 of 225 pass over the regenerated traces.

**Consequence.** The results file gains a `fixed` key beside `findings`.
