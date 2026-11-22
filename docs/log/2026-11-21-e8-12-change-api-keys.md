---
date: 2026-11-21
author: claude-agent
type: change
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/server/src/keys.ts
  - packages/cli/src/key.ts
  - packages/server/test/keys.test.ts
  - packages/cli/test/verified-actors.test.ts
  - docs/absorbed.md
  - NOTICE
supersedes: none
---

**What.** Local API keys, copied in part from TencentDB-Agent-Memory at 083c64b (MIT, licence read at the commit), and `engram key create | list | revoke`.

**Why.** Item 54 (a): hashed API keys for the local server.

**Result.** A key is `egk_`, a 12-character hex id, `_` and 32 base64url characters. It is stored as a salted scrypt hash, shown masked with its last four characters, carries a required expiry, and verifies in constant time. The server rereads the file when it changes, so a revocation applies at the next request. A verified key is remembered by a SHA-256 digest, so scrypt runs once per key. Key tests: 11 passed; CLI tests: 7 passed. The row is in `docs/absorbed.md`, the full notice in `NOTICE`.

**Consequence.** The key file is the actor registry for keys; each key is one actor in one capacity.
