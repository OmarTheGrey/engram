---
date: 2026-11-19
author: claude-agent
type: failure
card: RV1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/model/retry.ts
  - packages/runner/src/model/cassette.ts
  - packages/runner/test/rv1-review.test.ts
  - "pnpm --filter runner exec vitest run test/rv1-review.test.ts"
supersedes: none
---

**What.** The review (RV1-3) found that the usage ledger left out retried attempts and calls that failed for good, so the spend ceiling saw less than was paid.

**Why.** `withRetry` returned only the final reply, and `cached` records usage only for a reply it stores.

**Result.** Reproduced: 6 provider calls, 4 ledger records. Now every failed attempt is reported through `onUsage` as `hit: false` under the call's key, with no cassette entry, on the answer path, GateMem's and LongMemEval's judges and the lints. Two 429s then a read and an answer at 0.01 USD a call: 4 provider calls, 4 records, 0.04 USD; three 503s: 3 records, 0.03 USD. The review's 429 repro now reports `calls: {new: 3}` with 2 cassettes.

**Consequence.** A ledger's paid calls are its provider calls, so `calls.new` counts failed attempts too.
