---
date: 2026-10-29
author: claude-agent
type: failure
card: B1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/core/src/model.ts
  - packages/runner/src/model/pi.ts
  - packages/bench/src/gatemem/judge.ts
  - packages/bench/test/gatemem/judge.test.ts
supersedes: none
---

**What.** The judge port recorded two errors that must stop it as failed attempts (review findings P6-1, P6-2): `piModelCall`'s refusal of a structured-output request, and a judge reply holding a Python literal the port cannot represent (bytes, a set, a complex number).

**Why.** `judgeOne` rethrew only the offline cache miss. With the refusal, upstream's third attempt, which has no schema, still parsed, so a live run on pi-ai would have judged every checkpoint without the paper's strict schema and shown nothing wrong; with the literal, the next attempt's reply was judged where upstream stops at the first.

**Result.** The refusal is now `UnsupportedRequestError` (core), and `judgeOne` rethrows it and `UntranslatableLiteral` as it rethrows `OfflineMissError`. Four tests failed on the old code and pass now.

**Consequence.** A live judge cannot silently drop its schema.
