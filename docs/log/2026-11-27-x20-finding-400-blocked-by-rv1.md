---
date: 2026-11-27
author: claude-agent
type: finding
card: X20
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/rv1.test.ts
  - packages/runner/test/rv1-review.test.ts
  - docs/tasks/X20.md
supersedes: none
---

**What.** Excluding every non-retryable 400 at the answer call breaks two tests of card RV1, and X20's acceptance requires `rv1.test.ts` to pass unchanged.

**Why.** `rv1.test.ts:92` ("a failure that is not transient still fails the run") and `rv1-review.test.ts:238` ("is not retried by the outer loop") answer the call with `400 Bad Request` and expect the run to reject. Under the 400 rule the session is excluded and the run ends normally.

**Result.** With the rule applied (`leading === 400` and no key or credit words), `vitest run` over rv1, rv1-review, judge and x1-mem-inv gave 2 failed, 61 passed; the code was then restored. The branch keeps the old 400 reading.

**Consequence.** For the orchestrator: either change those two tests to use a non-transient error with no 400 status, which changes the acceptance's "unchanged", or keep the plain 400 as a stop.
