---
date: 2026-11-22
author: claude-agent
type: change
card: E8.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/transports.ts
  - packages/mcp/test/auth.test.ts
  - packages/mcp/test/attestation.test.ts
supersedes: docs/log/2026-11-21-e8-12-change-mcp-http.md
---

**What.** A correction. The earlier entry said no other credential could use an MCP session. That was false: a request with no credential at all, sent to the percent-encoded path `/%6Dcp`, reached the session (review finding E8.12-1).

**Why.** The guard compared the raw path, while Hono routes on the decoded one.

**Result.** The guard is now registered on `MCP_PATH` itself, and the handler fails closed when a request carries no principal. Eight spellings of the path all give 401 or 404 and append nothing, with or without a session id and after a revocation. The MCP auth tests now pass 5 of 5. Each layer holds alone; with both removed the regression test fails, as it did before the fix (HTTP 200, item stored).

**Consequence.** The claim now holds: only the session's own credential can use the session.
