---
date: 2026-11-19
author: claude-agent
type: failure
card: RV1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/judge.ts
  - packages/runner/test/rv1-review.test.ts
  - "pnpm --filter runner exec vitest run test/rv1-review.test.ts"
supersedes: none
---

**What.** The review of PR #55 (RV1-1, blocking) found that a judge or lint call failing for a transient reason after its retry was written into the cassette, so every resume replayed the failure.

**Why.** `liveJudgeCall` threw `JudgeCallFailed` for any failed reply, a 429 or 5xx that outlasted `JUDGE_RETRY` included, and `cachedJudgeCall` recorded every `JudgeCallFailed`.

**Result.** Reproduced by the reviewer: nine 503s, then a `RESUME=1` run with a healthy judge failed the same way with 0 calls. Now an exhausted transient failure is a `TransientCallError`, never recorded; `judgeOne` rethrows it, and only a non-transient failure on GateMem's judge path is recorded. LongMemEval's judge and the lints use plain `cached`. Tests: GateMem, LongMemEval and a lint each stop, then complete on a resume or rerun; the 400 still replays with zero calls.

**Consequence.** A transient outage never fixes a verdict.
