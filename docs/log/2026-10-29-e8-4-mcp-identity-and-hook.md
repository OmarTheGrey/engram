---
date: 2026-10-29
author: claude-agent
type: decision
card: E8.4
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/server.ts
  - packages/mcp/src/hook.ts
  - docs/decisions/0022-other-harnesses-through-mcp.md
supersedes: none
---

**What.** Choices ADR 0022 and plan decision 6 left open: the MCP server uses the SDK's low-level Server with the shared TypeBox schemas, runs no retention sweep after a write, serves HTTP statelessly behind the API's loopback guard, and the hook fails closed.

**Why.** McpServer would need the tool schemas restated in Zod (two definitions); a sweep needs a user-sourced actor to matter; a hook that errors out lets the call through in Claude Code.

**Result.** Recorded in ADR 0022's amendments. A test resolves every module the MCP server loads and finds no pi package; a block that cannot be recorded is still denied.

**Consequence.** If the MCP SDK drops the low-level Server, the tool list must be rebuilt on McpServer from the same JSON Schemas.
