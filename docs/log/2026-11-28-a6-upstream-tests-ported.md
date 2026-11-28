---
date: 2026-11-28
author: claude-agent
type: change
card: A6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/mcp-memory/upstream.test.ts
  - docs/absorbed.md
supersedes: none
---

**What.** The memory server's own tests that apply to the file format are ported against the adapter: 13 cases from extra-fields, persistence, file-lock and atomic-save, each naming the case it ports.

**Why.** The absorption convention asks for the source's tests of the part taken; the first round ported none (review finding 5).

**Result.** 12 pass and 1 skips on Windows (the file mode). Left out, and said in the file: the server's tool, protocol, limit, exit-handler and heartbeat cases, and the lock-break races, which the backlog holds.

**Consequence.** The register row names the tests and `isLockOwnerDead` in the test double.
