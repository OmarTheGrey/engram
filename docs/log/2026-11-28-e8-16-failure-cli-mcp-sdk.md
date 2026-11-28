---
date: 2026-11-28
author: claude-agent
type: failure
card: E8.16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/parity.test.ts
  - packages/mcp/test/leakage-agent.ts
supersedes: none
---

**What.** The CLI's parity suite could not import `@modelcontextprotocol/sdk`: the cli package does not depend on it.

**Why.** pnpm resolves a bare import from the importing file's package.

**Result.** The MCP client helper moved to `packages/mcp/test/leakage-agent.ts`, imported by relative path; no dependency added.

**Consequence.** None.
