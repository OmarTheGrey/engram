---
date: 2026-11-20
author: claude-agent
type: decision
card: RV5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/transports.ts
  - packages/mcp/src/server.ts
  - packages/mcp/test/sessions.test.ts
supersedes: none
---

**What.** MCP HTTP sessions: at most 64, the least recently used evicted past it; one with no request for 30 minutes closed, at a clock `serveHttp` and `mcpHttpApp` take; the last 1,024 ended ids remembered so a request naming one gets 404 saying it was evicted or expired. One server records at most 10,000 calls (`maxSteps`); past that memory_simulate refuses. stdio's drain takes injectable timers.

**Why.** The review left the bounds open. Least recently used keeps an active session alive; refusing keeps the report honest where replaying a cut workload would not, since later calls depend on earlier ones.

**Result.** sessions.test.ts covers the cap, both messages, the idle clock, the steps bound and the 30 s drain; a mutant of each turns its case red.

**Consequence.** A long session loses memory_simulate after 10,000 calls and must start again.
