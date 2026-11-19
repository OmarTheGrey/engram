---
date: 2026-11-19
author: claude-agent
type: change
card: RV1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/judge.ts
  - packages/runner/test/judge.test.ts
  - "pnpm --filter runner exec vitest run test/judge.test.ts"
supersedes: none
---

**What.** A judge or lint call that the provider answers with a failure, after the retry, is recorded as a cassette entry and replayed as the same failure (`cachedJudgeCall`; review finding RV-EXP-3).

**Why.** `liveJudgeCall` threw, GateMem's `judgeOne` recorded the failed attempt and went on, and the cache stored nothing, so `REPLAY=1` missed and a live rerun paid again and could change the verdict, against rule 7.

**Result.** In `packages/runner/test/judge.test.ts`, attempt 1 fails with a 400 and attempt 2 judges: two cassette entries, two paid calls; the offline replay gives the same row, attempts included, from two hits and no provider call. An aborted call, an offline miss and a refused request are still not recorded. The same wrapper serves LongMemEval's judge and cards L3 and L4's lint calls.

**Consequence.** A judge verdict, once paid for, is fixed for every replay.
