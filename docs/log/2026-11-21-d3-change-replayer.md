---
date: 2026-11-21
author: claude-agent
type: change
card: D3
chapter: implementation
pillar: distill
hypothesis: H5
evidence:
  - packages/runner/src/replay-validate.ts
  - packages/runner/scripts/run.ts
  - packages/runner/test/d3-validate.test.ts
  - research/configs/d3-validate-fixture.json
supersedes: none
---

**What.** The runner gains the replayer (`replay-validate.ts`): card D2's candidates, each held-out task as one pi SDK session without a candidate and one with it installed, every call through the cassette model, the task's own check as the oracle, and the replay presented to Plane.promote; `make run` dispatches its configs.

**Why.** Card D3 steps 2, 3 and 5.

**Result.** `make run CONFIG=research/configs/d3-validate-fixture.json` runs 25 sessions (5 without a candidate, 20 with one) from 98 committed cassettes. 13 tests pass (`make test-one T=packages/runner/test/d3-validate.test.ts`); making the state check always pass fails 2, and dropping the split fails 4.

**Consequence.** Card X11 can point the same replayer at H5's runs once tau2 takes an installed candidate.
