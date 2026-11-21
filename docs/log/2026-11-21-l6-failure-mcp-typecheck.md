---
date: 2026-11-21
author: claude-agent
type: failure
card: L6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/test/supersede.test.ts
supersedes: none
---

**What.** tsc rejected the MCP test's replacement item, built by spreading a fixture item over the item union. A probe through console.log printed nothing, since the test run swallows console output.

**Why.** Spreading the union widened `content`. The probe was meant to find the gate's decision.

**Result.** `pnpm exec tsc -p tsconfig.json` gave TS2345 in packages/mcp/test/supersede.test.ts. The item is now cast to MemoryItem, and the decision is asserted outright (allow).

**Consequence.** None.
