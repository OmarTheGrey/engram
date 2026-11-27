---
date: 2026-11-26
author: claude-agent
type: change
card: X20
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/answer-refusal.test.ts
  - packages/runner/src/model/retry.ts
  - packages/runner/src/judge.ts
  - packages/runner/test/x1-mem-inv.test.ts
supersedes: none
---

**What.** An HTTP 401, 402, 404 or a 403 that is not OpenRouter's moderation flag stops the run at the answer call, GateMem's and LongMemEval's judge and lint calls, and MEM-INV-Bench's note call, with a `ProviderStopError` that is never recorded and never retried by the outer session retry.

**Why.** Review X20-1 and X20-2 under the coordinator's decisions: a judge 402 was recorded as a failed attempt, and a gone pinned endpoint would have excluded every session.

**Result.** judgeOne swallows unknown errors, so `judgeAnswer` keeps the first stop, refuses later attempts without a call and rethrows it. Tested: a 402 at GateMem's judge, a 401 at LongMemEval's, 401, 402 and 404 at the note call, each status at the answer call, then RESUME=1. One x1-mem-inv test now fails a note with a 400.

**Consequence.** A credit failure mid H1 stops every shard instead of emptying it.
