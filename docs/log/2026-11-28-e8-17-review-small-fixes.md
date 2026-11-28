---
date: 2026-11-28
author: claude-agent
type: change
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/src/hook.ts
  - packages/cli/src/tui/screens/home.ts
  - packages/cli/test/tui/keys.test.ts
  - test/e2e/mcp.e2e.test.ts
supersedes: none
---

**What.** An `mcp__engram__*` call whose `tool_input` is not an object (Codex sends a non-JSON MCP argument as a string) is skipped, not denied; the hidden Home rows lose their dead letters and the letters test counts Home rows only, with a palette test for both hidden commands; the e2e test sets CODEX_HOME to its temporary home and checks the installed entry's shape against the fixture's.

**Why.** The review's findings 5, 7 and 8.

**Result.** codex hook 49, keys 22 and the e2e file 5 pass; another tool with the same input is still denied.

**Consequence.** None.
