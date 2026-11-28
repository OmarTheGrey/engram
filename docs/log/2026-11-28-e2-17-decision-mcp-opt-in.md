---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/server.ts
  - packages/cli/src/mcp.ts
supersedes: none
---

**What.** `memory_why_not` is listed only when `engram mcp --why-not` (`whyNot` in createMcpServer) asks for it, as card L6 did for memory_supersede; `toolList(true)` lists both optional tools for the suites.

**Why.** Condition C7's tool set is the four tools; the guard keeps every registered condition as it is.

**Result.** The default list is unchanged (mcp tests pass, 174, plus 2 new); the leak suite probes the new tool.

**Consequence.** The pi extension gets no tool; the card does not name it.
