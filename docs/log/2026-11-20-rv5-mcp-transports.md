---
date: 2026-11-20
author: claude-agent
type: change
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/transports.ts
  - packages/mcp/src/server.ts
  - packages/mcp/test/rv5.test.ts
  - docs/decisions/0022-other-harnesses-through-mcp.md
supersedes: none
---

**What.** `engram mcp --http` keeps one server per MCP session, and stdio answers the calls in flight when its input ends before it closes (findings RV-SRF-6 and RV-SRF-7).

**Why.** The stateless HTTP transport built a server per request, so memory_simulate replayed an empty workload; stdio closed on input end and the process exited before a pending reply.

**Result.** `packages/mcp/test/rv5.test.ts`: a session's simulate replays its write and read and another session's replays nothing; an unknown session id is 404; a reply delayed 200 ms past the input's end is written before `serveStdio` returns. All three fail against the old transports. The security test now opens with an initialize request, since a request without a session must start one.

**Consequence.** ADR 0022 has a proposed amendment; sessions are capped at 64.
