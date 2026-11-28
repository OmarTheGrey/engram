---
date: 2026-11-28
author: claude-agent
type: finding
card: A6
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/no-bypass.ts
  - packages/mcp/src/hook.ts
supersedes: none
---

**What.** A Claude Code session that also runs the MCP memory server can change the governed file through the server's own tools (`mcp__memory__delete_entities`, `add_observations`), a write the gate never sees, and the hook does not block them.

**Why.** The hook blocks store CLIs in shell commands and file tools inside a store root; an MCP tool of another server is neither.

**Result.** Engram content is not exposed by those tools (it lives only in the `engram` member), and what they change is adopted or retracted at the next read. Blocking `mcp__memory__*` would be a rule in core's `no-bypass.ts`, outside this card's files.

**Consequence.** For the lead: a backlog row for a hook rule naming the memory server's tools when an mcp-memory root is guarded.
