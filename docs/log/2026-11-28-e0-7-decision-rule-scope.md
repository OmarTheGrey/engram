---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.7
chapter: design
pillar: plane
hypothesis: none
evidence:
  - scripts/test/core-determinism-rule.test.ts
supersedes: none
---

**What.** The core rule refuses, beyond the card's four forms, `Date()` called as a function, `new Date` with no parentheses, `process.hrtime` and the random functions of `node:crypto` and Web Crypto; the transport files are exempt for `Date.now` only.

**Why.** Each returns the time or a random value as surely as the four named, and claim C44 says core draws no randomness at all. None occurs in core today, so the wider rule moves no source; exempting the two files for `Date.now` alone keeps a random call there refused.

**Result.** The real tree is clean; a test asserts each exemption is still used, so a stale one fails.

**Consequence.** If wrong, a future core change that needs `randomUUID` must inject it, as clocks are.
