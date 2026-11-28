---
date: 2026-11-28
author: claude-agent
type: change
card: E2.19
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/plane/approvals.ts
  - packages/core/src/plane/promote.ts
  - packages/core/src/oracle.ts
  - packages/core/test/unit/plane/approvals-review.test.ts
  - "make test-one T=packages/core/test/unit/plane/approvals-review.test.ts"
supersedes: none
---

**What.** The review of 2026-11-28 fixed: the commit's transaction asks the request again, so a refusal or recorded expiry on another handle wins (F1); without an approval block `refuse` and `expireRequests` are one `engram/approval/off` deny (F2); requests are keyed by version and target, each with its own route and expiry, in the queue, the evaluator and the oracle (F3); a drift restore's ask opens a restore request an approver acts on through `revalidate(review)`, never closing the version (F4); the pin is checked first (F8); a person route must name `owner` (F9).

**Why.** Changes requested by the second reviewer.

**Result.** 15 tests pass; one mutant per fix, each killed.

**Consequence.** D5's hold remains (step 5).
