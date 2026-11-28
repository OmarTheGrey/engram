---
date: 2026-11-28
author: claude-agent
type: change
card: E1.7
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/adopt.ts
  - packages/core/test/unit/plane/erasure-gaps.test.ts
supersedes: none
---

**What.** A new write under an id an offboarding swept is refused (`engram/write/erased`) at the decision and at the commit, and each adoption purge, a first one or the `decided` retry, checks under the log's lock just before its delete that its item has not changed, nor an erasure of its scope begun, since the refusal (the retry: since the listing).

**Why.** Finding E1.5-8 and E18-F4: a write under a swept id was allowed, then lost its record to the purge; a repeated purge ran from a listing older than a change.

**Result.** Three tests in `erasure-gaps.test.ts`, both backends: the write is refused naming the sweep; a change between refusal and purge leaves the record (`deferred` 1); a stale retry leaves bytes it never listed. Main's `write.ts` restored fails only the first.

**Consequence.** A deferred purge is counted under the adoption report's `deferred`; no new field or rule.
