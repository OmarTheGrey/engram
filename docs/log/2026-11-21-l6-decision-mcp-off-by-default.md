---
date: 2026-11-21
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/L6.md
  - packages/mcp/src/server.ts
supersedes: none
---

**What.** `memory_supersede` is off by default, and it is defined in packages/mcp/src/server.ts rather than in pi-extension/src/tools.ts.

**Why.** Condition C7 is defined as the Engram tools over MCP, and tools.ts is shared with the runner's C2 and C3 tools. Under the pre-registration guard, new behaviour is off by default.

**Result.** The default-off tests in packages/mcp/test/supersede.test.ts; the four-tool assertions in mcp.test.ts and test/e2e are unchanged.

**Consequence.** pi has no supersede tool; a later card can add one to tools.ts once the registered conditions allow it.
