---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
supersedes: none
---

**What.** After a purge's refusal, a later adoption that lists the same bytes retries the delete without a new refusal, and appends an event only when the outcome differs from the last recorded: a new error, a success after a failure, or a first refusal for good.

**Why.** V-9 and V-10: a bounded log, and reasons that say what happened.

**Result.** V6 and V7 pass; dropping the outcome check, the retry branch or the failure event each fails them.

**Consequence.** A store whose transient error never changes is retried silently on every adoption.
