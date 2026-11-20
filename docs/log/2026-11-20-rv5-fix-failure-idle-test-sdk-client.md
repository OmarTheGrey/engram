---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/test/sessions.test.ts
supersedes: none
---

**What.** The first idle-expiry test, with sessions opened by the MCP SDK's client, kept the idle session alive: the request naming it answered 200, not 404.

**Why.** The SDK client sends requests of its own under its session id, which refresh the transport's idle clock.

**Result.** The test starts sessions with a raw `initialize` request and names them only in its own requests; the eviction test, which first assumed oldest-first, now expects the least recently used to go.

**Consequence.** None beyond the fix.
