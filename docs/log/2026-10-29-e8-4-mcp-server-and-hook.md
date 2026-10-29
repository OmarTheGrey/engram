---
date: 2026-10-29
author: claude-agent
type: change
card: E8.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/server.ts
  - packages/mcp/src/hook.ts
  - packages/mcp/test/mcp.test.ts
  - fixtures/harness/README.md
  - test/e2e/mcp.e2e.test.ts
  - "pnpm --filter mcp test"
  - "make test-e2e"
supersedes: none
---

**What.** Card E8.4: `engram mcp` serves the four memory tools over stdio and loopback streamable HTTP as one actor fixed at launch with source `model`, and `engram hook claude-code` blocks store bypasses in Claude Code.

**Why.** ADR 0022 and plan decision 6: Claude Code and Codex reach the plane through MCP, and the model must never choose who it acts as.

**Result.** An MCP client explains a fixture read over the in-memory, stdio and HTTP transports; a write claiming `user` lands as `model` (mutant with source `user` caught); the hook blocks store commands and paths inside a root (mutant without the Bash branch caught by 5 tests). `make test-e2e` runs the handshake from the Claude Code and Codex fixtures: 13 passed. `pnpm --filter mcp test`: 29 passed.

**Consequence.** Condition C7's MCP path exists; the store-command check now lives in core.
