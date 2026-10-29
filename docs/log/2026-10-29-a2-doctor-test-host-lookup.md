---
date: 2026-10-29
author: claude-agent
type: finding
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/review-verification.test.ts
supersedes: none
---

**What.** Most of the time of "doctor and write print no part of the secret" is name lookups of the host `h` in two of its URLs, not the store probes.

**Why.** Found while fixing R2-5: with the probes replaced the test still took 18 s alone.

**Result.** One doctor or write against `postgres://u:pw@h:5432/db` took about 8.8 s on this Windows machine, against 60 ms for 127.0.0.1 (measured with a scratch script calling `run` in process).

**Consequence.** The test keeps a 60 s timeout; replacing `h` with an address that fails fast is a separate change to that test's cases.
