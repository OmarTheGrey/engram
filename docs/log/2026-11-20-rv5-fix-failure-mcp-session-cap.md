---
date: 2026-11-20
author: claude-agent
type: failure
card: RV5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/transports.ts
  - packages/mcp/src/server.ts
  - packages/mcp/test/sessions.test.ts
supersedes: none
---

**What.** Review of PR #59, RV5-5: the MCP HTTP transport answered an evicted session with a bare "Session not found", kept an idle session until 64 newer ones pushed it out, let a session's memory_simulate workload grow without bound, and had no test of the cap, the eviction or stdio's 30 s drain.

**Why.** RV5 added the cap without the rest.

**Result.** sessions.test.ts was red on all five cases before the fix and green after; see rv5-fix-decision-mcp-session-bounds.

**Consequence.** A client whose session ended is told why and can start a new one.
