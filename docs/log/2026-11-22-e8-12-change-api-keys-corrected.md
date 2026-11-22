---
date: 2026-11-22
author: claude-agent
type: change
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/keys.ts
  - packages/server/test/keys.test.ts
  - docs/absorbed.md
supersedes: docs/log/2026-11-21-e8-12-change-api-keys.md
---

**What.** A correction. The earlier entry said scrypt runs once per key. That is true for a valid key only: a wrong or unknown key pays scrypt on every request. Verification has also changed since.

**Why.** Review findings E8.12-4 and E8.12-5 (the lead chose to keep scrypt, made asynchronous).

**Result.** Verification runs `crypto.scrypt` on the thread pool, where the copied code ran scryptSync. It accepts only r = 8, p = 1, a power-of-two N up to 2^16, and a hash of at least 32 bytes. A p = 64 hash is refused before scrypt runs, and the call returns before scrypt does. Each of those two tests fails under its mutation. Key tests: 13 passed. The `docs/absorbed.md` row and the file header say so.

**Consequence.** A flood of wrong keys costs thread-pool time, not the event loop.
