---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/transports.ts
  - packages/mcp/test/auth.test.ts
supersedes: none
---

**What.** The MCP transport's credential check could be skipped with a percent-encoded path. The review found it (E8.12-1, critical); my tests had not.

**Why.** The guard ran on `*` and compared the raw pathname with `/mcp`. Hono routes on the decoded path, so `/%6Dcp` reached the handler with no principal, and the session-owner check was skipped.

**Result.** Before the fix, the regression test reproduced the review's probe. With Dana's key revoked, a `memory_write` to `/%6Dcp` carrying her session id and no Authorization header answered 200 and stored the item, which was attested `insecure_loopback`/`unattributed`. The API was not affected (its guard decodes with `isApiPath`), but it now fails closed too (E8.12-3).

**Consequence.** A guard keyed on a path is registered on the routed path, and a handler on a server with credentials refuses a request that carries no principal.
