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
  - packages/runner/test/rv1-review.test.ts
supersedes: docs/log/2026-11-19-rv1-judge-failures-recorded.md
---

**What.** GateMem's judge records only a failure that is not transient (a 400, a 401); a transient failure that outlasted the retry stops the run unrecorded, and LongMemEval's judge and the lints record no failure at all (review RV1-1).

**Why.** The earlier entry said a verdict, once paid for, is fixed, which hid that a 429 or 5xx burst was fixed too. GateMem's `judgeOne` goes on to its next attempt after a failed one, so a recorded non-transient failure keeps its replay faithful; the other callers stop on any failure, so recording one would only stop every resume.

**Result.** Attempt 1 failing with a 400 and attempt 2 judging replays with two hits and no call (`packages/runner/test/judge.test.ts`); nine 503s stop the run with nothing recorded, and a resume with a healthy judge records one verdict from one new call (`packages/runner/test/rv1-review.test.ts`).

**Consequence.** A failed call's usage still reaches the ledger.
