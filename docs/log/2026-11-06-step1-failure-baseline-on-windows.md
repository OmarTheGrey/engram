---
date: 2026-11-06
author: claude-agent
type: failure
card: none
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - packages/core/test/unit/schema.test.ts
  - packages/runner/test/retrieval.test.ts
  - "make test"
supersedes: none
---

**What.** `make test` on clean main (9a0d185) failed on a Windows 11 laptop with the checkout at a path holding a space (`D:\Graduation Project\engram`), before any change for step 1.

**Why.** Two causes. With the default worker count (139 workers), 46 of 2,501 tests failed, nearly all on time limits in the embedded Postgres, Letta MemFS and child-process tests; with `VITEST_MAX_WORKERS=4`, 10 failed, 8 of them still time limits (`cli/test/doctor*.test.ts`, which pass alone, 48 of 48, and Letta conformance). The other two are path bugs: `schema.test.ts:12` and `retrieval.test.ts:45` build a path from `URL.pathname`, which keeps the space as `%20`.

**Result.** These 10 are the baseline step 1 is compared against.

**Consequence.** Run the suite with fewer workers on a laptop; the `%20` paths need `fileURLToPath`, a fix outside this item.
