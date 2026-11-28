---
date: 2026-11-28
author: claude-agent
type: failure
card: E8.17
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/mcp/test/codex-hook.test.ts
supersedes: none
---

**What.** `tsc` failed on the Codex test's `call` helper typing `tool_input` as unknown.

**Why.** PreToolUseInput types it as an object or undefined.

**Result.** Typed as an object; the null case builds its input explicitly. `tsc -p tsconfig.json` exits 0.

**Consequence.** Nothing.
