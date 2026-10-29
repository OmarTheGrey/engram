---
date: 2026-10-28
author: claude-agent
type: failure
card: E2.3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/write.test.ts
  - "pnpm exec vitest run packages/core/test/unit/plane/write.test.ts"
supersedes: none
---

**What.** The first version of the test that a failed store write does not stall the write queue (finding N2) was wrong. It passed before the queue existed and failed once the queue was in.

**Why.** The test set the store fault, started the write, then cleared the fault. That relied on the store being called synchronously. Behind the queue, the store is called later, after the fault is cleared, so the "failing" write succeeded.

**Result.** The fault now fails by item id, not by when it is set. The test fails against a queue that does not swallow rejections, and passes against the real one.

**Consequence.** In a test of queued work, set faults by what they apply to, not by when they are set.
