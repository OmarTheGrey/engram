---
date: 2026-11-28
author: claude-agent
type: decision
card: E8.17
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/hook.ts
  - packages/mcp/test/codex-hook.test.ts
supersedes: none
---

**What.** For Codex a null `tool_input` is read as no arguments; any other non-object is denied, as for Claude Code.

**Why.** Codex's input schema types `tool_input` as any value (`true`), and an MCP tool with no arguments can send null; denying it would block such tools outright.

**Result.** A null input still goes through the path check on no arguments.

**Consequence.** None known.
