---
date: 2026-11-28
author: claude-agent
type: change
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/test/leakage.test.ts
  - packages/mcp/test/leakage-agent.ts
supersedes: none
---

**What.** MCP's leak suite: every tool the server can list, memory_supersede included, called as each probe actor on the canary workspace through the generated client.

**Why.** Card E8.16 names MCP as one of the four surfaces; the agent's identity is fixed at launch, so each probe actor is one server.

**Result.** `make test-one T=packages/mcp/test/leakage.test.ts`: 8 passed; 288 probes, no canary leaked; a tool with no probe fails; memory_supersede answers a hidden id and a never-held one alike, memory_explain does not (finding `2026-11-28-e8-16-finding-explain-403-404.md`).

**Consequence.** The MCP client helper is shared with the CLI's parity suite, which has no MCP SDK of its own.
