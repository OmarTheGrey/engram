---
date: 2026-11-21
author: claude-agent
type: failure
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/keys.ts
  - packages/server/test/keys.test.ts
supersedes: none
---

**What.** The copied `verifyPasswordHash` of TencentDB-Agent-Memory accepted a stored hash cut short.

**Why.** The key test feeds malformed hashes and expects each to be false; the one with its last four characters removed came back true.

**Result.** The verifier takes the expected hash's length as the scrypt output length, and scrypt's shorter outputs are prefixes of its longer ones. A hash cut to one byte would accept one key in 256. `make test-one T=packages/server/test/keys.test.ts` failed at line 88 ("expected true to be false"). `verifyKeyHash` now refuses a hash shorter than 32 bytes and a cost N above 2^20, and the test passes (11 of 11).

**Consequence.** Only a tampered key file reaches this, but the guard stays. It is a divergence from the source, stated in the file's header comment.
