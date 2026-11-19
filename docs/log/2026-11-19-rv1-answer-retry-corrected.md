---
date: 2026-11-19
author: claude-agent
type: change
card: RV1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/cassette.ts
  - packages/runner/test/rv1.test.ts
supersedes: docs/log/2026-11-19-rv1-answer-retry.md
---

**What.** The review's 429 repro gives one row, three provider calls, three paid calls in the ledger and two cassettes; the earlier entry said two new calls.

**Why.** Since the review fix RV1-3 the failed attempt's usage is in the ledger, as it was paid for; only the read and the answer are recorded.

**Result.** In `packages/runner/test/rv1.test.ts` the repro asserts `calls: {new: 3, cached: 0}` and two cassette files. A transient failure that outlasts the answer path's retry now throws `TransientCallError`, which the outer session retry waits out (see the decision on it).

**Consequence.** Nothing else changes in the retry.
