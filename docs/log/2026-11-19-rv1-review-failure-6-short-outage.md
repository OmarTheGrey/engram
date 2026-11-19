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
  - packages/runner/test/rv1-review.test.ts
  - "pnpm --filter runner exec vitest run test/rv1-review.test.ts"
supersedes: none
---

**What.** The review (RV1-6) found that any transient outage longer than about 3 seconds stopped a live run, which then needed `RESUME=1`, and that `Retry-After` is not honoured.

**Why.** The answer path's retry is the benchmark client's (three attempts, waits of 1 and 2 seconds), and nothing retried above it.

**Result.** Fixed by an outer session retry (`SESSION_RETRY`, `retrySession`), set by `make run` for a live run; see its decision entry. Test: three 503s exhaust the call's retry, the session runs again after a 30-second injected wait, from its cassettes, and the run completes; a 400 is not retried. `Retry-After` is still not honoured.

**Consequence.** A live run stops only after about 12 minutes of outage.
