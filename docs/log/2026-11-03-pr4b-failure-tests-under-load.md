---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/count.test.ts
  - packages/cli/test/doctor.test.ts
supersedes: none
---

**What.** Tests timed out under machine load: one of the 11 count tests, whose name I did not capture, and 8 doctor tests at the 30-second limit.

**Why.** The machine's CPU stood at 100 percent while other sessions ran, and the first count run shared it with a pytest run of this worktree.

**Result.** Rerun alone, `packages/runner/test/count.test.ts` passed 11 of 11 in 26 seconds and the doctor's 14 pin tests passed. The first count run's output was filtered to its summary, so the failing test is not known.

**Consequence.** Gates run one at a time here, and a timeout is rerun alone before it is taken for a fault.
