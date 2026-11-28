---
date: 2026-11-28
author: claude-agent
type: finding
card: A6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/hook.ts
  - packages/mcp/test/hook.test.ts
supersedes: none
---

**What.** The orchestrator asked for the delete-tool rule's tests in the Claude Code and the Codex hook suites; main has no Codex hook, so the rule is tested in core's no-bypass suite and the Claude Code hook's.

**Why.** Codex reaches Engram through the MCP server only; its hook is card E8.17's, not merged.

**Result.** The rule lives in core's `toolBypass`, so the pi extension's `tool_call` check gets it too, and a Codex hook built on `hookBypass` will.

**Consequence.** Card E8.17 adds the Codex cases when it lands.
